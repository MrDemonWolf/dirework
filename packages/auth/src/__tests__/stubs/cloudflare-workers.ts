/**
 * Vitest stub for the `cloudflare:workers` module, so `@dirework/env/server`
 * (and through it the real createAuth) loads under Node. Values are inert
 * placeholders; tests flip DEV_LOGIN on this object to exercise the gate.
 */
export const env: Record<string, string | undefined> = {
  TWITCH_CLIENT_ID: "test-client-id",
  TWITCH_CLIENT_SECRET: "test-client-secret",
  BETTER_AUTH_SECRET: "test-auth-secret-that-is-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:3001",
  CORS_ORIGIN: "http://localhost:3001",
  DEV_LOGIN: undefined,
  DEV_LOGIN_SECRET: "test-dev-login-secret",
};
