import { count } from "drizzle-orm";
import { createDb, type DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { devLoginPlugin, isDevLoginEnabled } from "./dev-login";

/** Returns true if an owner account already exists in the database. */
export async function hasOwner(db: DbClient = createDb()): Promise<boolean> {
  const [row] = await db.select({ count: count() }).from(schema.user);
  return (row?.count ?? 0) > 0;
}

/**
 * Per-request better-auth factory — Workers isolate per request, so there are
 * no module-level auth/db singletons. Call inside a request handler.
 *
 * Cookie topology: the browser only ever talks to the WEB worker origin
 * (env.BETTER_AUTH_URL); the web app's app/api/auth/[...all] route handler
 * proxies /api/auth/* same-origin to this API worker, forwarding redirects
 * and Set-Cookie verbatim. From the browser's perspective everything is
 * same-origin, so
 * cookies are plain sameSite=lax + secure + httpOnly — no sameSite=none, no
 * crossSubDomainCookies (workers.dev is on the Public Suffix List anyway).
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
    // DEV ONLY: the bypass-login endpoint (POST /api/auth/dev-login) exists only
    // when DEV_LOGIN==="true". Unset in prod → plugin unregistered → route 404s.
    plugins: isDevLoginEnabled(env.DEV_LOGIN) ? [devLoginPlugin()] : [],
    socialProviders: {
      twitch: {
        clientId: env.TWITCH_CLIENT_ID,
        clientSecret: env.TWITCH_CLIENT_SECRET,
        mapProfileToUser: (profile) => ({
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
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (await hasOwner(db)) {
              throw new APIError("FORBIDDEN", {
                message: "This instance is already claimed. Single-user only.",
              });
            }
            return { data: { ...user, isOwner: true } };
          },
        },
      },
      session: {
        create: {
          after: async () => {
            // Provision singleton config rows on every login. Explicit id is
            // required: SQLite rejects an upsert clause on `DEFAULT VALUES`,
            // and D1 batch keeps it atomic in one round trip.
            await db.batch([
              db.insert(schema.timerConfig).values({ id: schema.SINGLETON_ID }).onConflictDoNothing(),
              db.insert(schema.timerStyle).values({ id: schema.SINGLETON_ID }).onConflictDoNothing(),
              db.insert(schema.taskStyle).values({ id: schema.SINGLETON_ID }).onConflictDoNothing(),
              db.insert(schema.botConfig).values({ id: schema.SINGLETON_ID }).onConflictDoNothing(),
              db.insert(schema.instanceConfig).values({ id: schema.SINGLETON_ID }).onConflictDoNothing(),
            ]);
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
