import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Twitch OAuth
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),

    // User allowlist (comma-separated Twitch user IDs, empty = allow all)
    ALLOWED_TWITCH_IDS: z.string().default(""),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
