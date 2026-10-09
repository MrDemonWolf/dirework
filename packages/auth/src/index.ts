import { count, lt } from "drizzle-orm";
import { createDb, type DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { devLoginPlugin, isDevLoginEnabled } from "./dev-login";
import { persistTwitchIdFromAccount } from "./twitch-identity";

/** Returns true if an owner account already exists in the database. */
export async function hasOwner(db: DbClient = createDb()): Promise<boolean> {
  const [row] = await db.select({ count: count() }).from(schema.user);
  return (row?.count ?? 0) > 0;
}

/** Error code for a sign-in that would create a second user. */
export const INSTANCE_CLAIMED_ERROR = "instance_claimed";

/**
 * The single-user gate: the first user to be created claims the instance as
 * owner; every later user creation is refused. Wired as the user-create hook.
 */
export async function claimInstance<T extends Record<string, unknown>>(db: DbClient, user: T) {
  if (await hasOwner(db)) {
    // better-auth's OAuth callback turns this message into the `?error=` code
    // on the sign-in redirect, so it is a stable, machine-readable token the
    // web app maps to its own copy (apps/web/src/lib/sign-in-errors.ts).
    throw new APIError("FORBIDDEN", { message: INSTANCE_CLAIMED_ERROR });
  }
  return { data: { ...user, isOwner: true } };
}

/** Delete expired session rows (runs at sign-in, so it costs no extra requests). */
export async function purgeExpiredSessions(db: DbClient, now: Date = new Date()): Promise<void> {
  await db.delete(schema.session).where(lt(schema.session.expiresAt, now));
}

/**
 * better-auth requires a unique email per user, but Dirework never needs the
 * owner's real one, so the email scope is not requested. A per-Twitch-account
 * address on the reserved .invalid TLD satisfies the requirement, can never
 * receive mail, and cannot collide with (or be linked to) another account.
 * Migration 0014_scrub_owner_pii rewrites older rows to this same format.
 */
export function twitchPlaceholderEmail(twitchId: string): string {
  return `${twitchId}@users.twitch.invalid`;
}

/**
 * better-auth routes Dirework never uses. Several would hand out or rotate the
 * owner's Twitch tokens or mutate the owner row; disabled paths return 404.
 */
export const DISABLED_AUTH_PATHS = [
  "/update-user",
  "/update-session",
  "/delete-user",
  "/delete-user/callback",
  "/change-email",
  "/change-password",
  "/sign-up/email",
  "/sign-in/email",
  "/reset-password",
  "/request-password-reset",
  "/verify-password",
  "/verify-email",
  "/send-verification-email",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/get-access-token",
  "/refresh-token",
  "/account-info",
];

/** The owner's own Twitch OAuth tokens are never used, so they are never stored. */
const DROPPED_OWNER_TOKENS = { accessToken: null, refreshToken: null, idToken: null };

/**
 * Per-request better-auth factory — Workers isolate per request, so there are
 * no module-level auth/db singletons. Call inside a request handler.
 *
 * Cookie topology: the browser only ever talks to the WEB worker origin
 * (env.BETTER_AUTH_URL); the web app's app/api/auth/[...all] route handler
 * proxies /api/auth/* same-origin to this API worker, forwarding redirects
 * and Set-Cookie verbatim. From the browser's perspective everything is
 * same-origin, so
 * cookies are plain host-only sameSite=lax + secure + httpOnly — no
 * sameSite=none, no crossSubDomainCookies. Other workers under the same
 * <account>.workers.dev are same-site, so Lax is not a CSRF boundary; the api
 * worker's JSON-only /trpc guard is.
 */
export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),

    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.CORS_ORIGIN],

    emailAndPassword: {
      enabled: false,
    },
    disabledPaths: DISABLED_AUTH_PATHS,
    // One provider, one identity: never attach a second Twitch account to the
    // owner because it shares the owner's email. Sign-ins match on the Twitch
    // account id instead, so the owner's own sign-ins are unaffected.
    account: {
      accountLinking: { enabled: false },
    },
    // DEV ONLY: the bypass-login endpoint (POST /api/auth/dev-login) exists only
    // when DEV_LOGIN==="true". Unset in prod → plugin unregistered → route 404s.
    // The endpoint also requires the per-run DEV_LOGIN_SECRET header.
    plugins: isDevLoginEnabled(env.DEV_LOGIN) ? [devLoginPlugin(env.DEV_LOGIN_SECRET)] : [],
    socialProviders: {
      twitch: {
        clientId: env.TWITCH_CLIENT_ID,
        clientSecret: env.TWITCH_CLIENT_SECRET,
        // openid only: without user:read:email Twitch never returns the email.
        disableDefaultScope: true,
        scope: ["openid"],
        // Only the id_token claims mapProfileToUser/getUserInfo read (sub is
        // always present): the login name and the avatar shown in the user
        // menu. NOTE: better-auth 1.6's createAuthorizationURL still merges
        // email/email_verified into the claims param whatever is passed here;
        // Twitch omits them unless user:read:email is granted, which it never
        // is. The privacy policy wording reflects exactly this.
        claims: ["preferred_username", "picture"],
        mapProfileToUser: (profile) => ({
          email: twitchPlaceholderEmail(profile.sub),
          emailVerified: false,
          twitchId: profile.sub,
          displayName: profile.preferred_username,
        }),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        twitchId: { type: "string", required: false, input: false },
        displayName: { type: "string", required: false, input: false },
        isOwner: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    advanced: {
      // Session rows never record the client IP. Abuse limiting is the
      // Cloudflare rate-limit binding on the api worker, not better-auth's.
      ipAddress: { disableIpTracking: true },
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: (user) => claimInstance(db, user),
        },
      },
      account: {
        create: {
          before: async (account) => ({ data: { ...account, ...DROPPED_OWNER_TOKENS } }),
          after: async (account) => {
            await persistTwitchIdFromAccount(db, account);
          },
        },
        update: {
          before: async (account) => ({ data: { ...account, ...DROPPED_OWNER_TOKENS } }),
        },
      },
      session: {
        create: {
          // Nothing reads the user agent or IP, so sessions don't keep them.
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
          after: async () => {
            // Provision singleton config rows on every login — shared
            // implementation in @dirework/db/provision (also used by the
            // API's lazy provisioning, so the two paths cannot drift).
            await provisionSingletonRows(db);
            await purgeExpiredSessions(db);
          },
        },
      },
    },
  });
}
