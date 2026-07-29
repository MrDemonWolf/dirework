/**
 * Vitest stub for the `cloudflare:workers` module.
 *
 * Vitest runs in Node, which cannot resolve the Workers-runtime module, so any
 * import chain touching `@dirework/env/server` (bot.ts → appRouter) used to be
 * untestable — which is why the router tests only ever exercised input schemas.
 * Aliasing it here lets the REAL appRouter load so procedures can be driven
 * through `createCaller`.
 *
 * These values are inert placeholders: tests that care about Twitch behaviour
 * stub `fetch`, and nothing here is a real credential.
 */
export const env = {
  TWITCH_CLIENT_ID: "test-client-id",
  TWITCH_CLIENT_SECRET: "test-client-secret",
  BETTER_AUTH_SECRET: "test-auth-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3001",
  DOCS_URL: "http://localhost:4000",
  DEV_LOGIN: "false",
  DB: undefined,
};
