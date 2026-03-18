import { db } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";

/**
 * Parse the ALLOWED_TWITCH_IDS env var into a Set.
 * Empty string or undefined → empty set (allow all).
 */
export function parseAllowedTwitchIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

const allowedTwitchIds = parseAllowedTwitchIds(env.ALLOWED_TWITCH_IDS);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),

  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    twitch: {
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Enforce ALLOWED_TWITCH_IDS allowlist on account creation
          if (allowedTwitchIds.size > 0) {
            const twitchId = (user as Record<string, unknown>).twitchId as string | undefined;
            if (!twitchId || !allowedTwitchIds.has(twitchId)) {
              throw new APIError("FORBIDDEN", {
                message: "Your Twitch account is not authorized to use this instance.",
              });
            }
          }
          return { data: user };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // Provision config rows on every login — onConflictDoNothing is atomic
          const userId = session.userId;
          await Promise.all([
            db.insert(schema.timerConfig).values({ userId }).onConflictDoNothing(),
            db.insert(schema.timerStyle).values({ userId }).onConflictDoNothing(),
            db.insert(schema.taskStyle).values({ userId }).onConflictDoNothing(),
            db.insert(schema.botConfig).values({ userId }).onConflictDoNothing(),
          ]);
        },
      },
    },
  },
  plugins: [nextCookies()],
});
