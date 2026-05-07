import { count } from "drizzle-orm";
import { db } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";

/** Returns true if an owner account already exists in the database. */
export async function hasOwner(): Promise<boolean> {
  const [row] = await db.select({ count: count() }).from(schema.user);
  return (row?.count ?? 0) > 0;
}

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
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const [row] = await db.select({ count: count() }).from(schema.user);
          if ((row?.count ?? 0) > 0) {
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
          // Provision singleton config rows on every login — onConflictDoNothing is atomic
          await Promise.all([
            db.insert(schema.timerConfig).values({}).onConflictDoNothing(),
            db.insert(schema.timerStyle).values({}).onConflictDoNothing(),
            db.insert(schema.taskStyle).values({}).onConflictDoNothing(),
            db.insert(schema.botConfig).values({}).onConflictDoNothing(),
            db.insert(schema.instanceConfig).values({}).onConflictDoNothing(),
          ]);
        },
      },
    },
  },
  plugins: [nextCookies()],
});
