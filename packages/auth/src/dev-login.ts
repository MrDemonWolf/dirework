import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

/**
 * DEV-ONLY login bypass.
 *
 * Strictly gated: this plugin is only registered by createAuth() when the
 * DEV_LOGIN env flag is exactly the string "true". In every other case
 * (undefined, "", "1", "TRUE", "false", …) the flag is off, the plugin is never
 * added, and POST /api/auth/dev-login returns 404. Production never sets
 * DEV_LOGIN, so the endpoint does not exist there. See createAuth().
 */
export function isDevLoginEnabled(flag?: string): boolean {
  return flag === "true";
}

/** Header carrying the per-run dev-login secret (printed by `bun run dev`). */
export const DEV_LOGIN_SECRET_HEADER = "x-dev-login-secret";

/**
 * Constant-time check of the presented secret against the configured one. An
 * empty configured secret refuses everything (fail closed), so DEV_LOGIN=true
 * alone never opens the endpoint to other devices on the network.
 */
export function devLoginSecretMatches(expected: string | undefined, presented: string | null) {
  if (!expected || !presented) return false;
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(presented);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Fixed identity used only when the local DB has no owner yet. */
const DEV_USER = {
  email: "dev@localhost",
  name: "Dev Streamer",
  displayName: "Dev Streamer",
} as const;

/**
 * A better-auth plugin exposing a single POST /dev-login endpoint that mints a
 * real, natively-signed better-auth session for the instance owner — no
 * email/password, no hand-forged cookie. Single-user instance: if an owner
 * already exists (claimed via real Twitch or a prior bypass) we log in as that
 * same user; otherwise we create it, which trips the existing user-create hook
 * that claims ownership. createSession fires the session-create hook that
 * provisions the singleton config rows, exactly like a real login.
 *
 * Every request must present the per-run secret in DEV_LOGIN_SECRET_HEADER:
 * the dev servers listen on all interfaces, so the flag alone is not enough.
 */
export function devLoginPlugin(secret: string | undefined): BetterAuthPlugin {
  return {
    id: "dev-login",
    endpoints: {
      devLogin: createAuthEndpoint("/dev-login", { method: "POST" }, async (ctx) => {
        if (!devLoginSecretMatches(secret, ctx.headers?.get(DEV_LOGIN_SECRET_HEADER) ?? null)) {
          throw new APIError("FORBIDDEN", {
            message: "dev-login: missing or wrong secret (see the `bun run dev` output)",
          });
        }
        const adapter = ctx.context.internalAdapter;

        // Single-user instance — the sole existing user IS the owner.
        const [owner] = await adapter.listUsers(1, 0);
        const user = owner ?? (await adapter.createUser({ ...DEV_USER }));

        if (!user) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "dev-login: failed to resolve a user",
          });
        }

        // dontRememberMe=false → full 30-day session (session.expiresIn).
        const session = await adapter.createSession(user.id, false);
        if (!session) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "dev-login: failed to create a session",
          });
        }

        await setSessionCookie(ctx, { session, user });
        return ctx.json({ ok: true });
      }),
    },
  };
}
