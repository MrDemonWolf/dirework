import prisma from "@dirework/db";
import { env } from "@dirework/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

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
    session: {
      create: {
        after: async (session) => {
          // Provision config rows on every login — upsert is atomic (no race conditions)
          const userId = session.userId;
          await Promise.all([
            prisma.timerConfig.upsert({ where: { userId }, create: { userId }, update: {} }),
            prisma.timerStyle.upsert({ where: { userId }, create: { userId }, update: {} }),
            prisma.taskStyle.upsert({ where: { userId }, create: { userId }, update: {} }),
            prisma.botConfig.upsert({ where: { userId }, create: { userId }, update: {} }),
          ]);
        },
      },
    },
  },
  plugins: [nextCookies()],
});
