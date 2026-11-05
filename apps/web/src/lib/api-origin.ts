/**
 * The api worker's origin — the single resolver for every web-side caller
 * (Next rewrites + CSP, the OAuth route-handler proxy, server-side session
 * checks, and the direct `publicTrpc` client).
 *
 * `||` not `??`: an empty NEXT_PUBLIC_SERVER_URL (unset GH deploy var) would
 * slip past `??` and make every target relative to the web origin itself.
 * Falls back to localhost so plain `next dev` works without a deployed api
 * worker. Trailing slashes are stripped so `${apiOrigin()}/trpc` never doubles
 * up. `process.env.NEXT_PUBLIC_SERVER_URL` is spelled out literally so Next can
 * inline it into client bundles.
 */
export function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * The web worker's own origin, from BETTER_AUTH_URL (bound on the worker in prod and dev):
 * the canonical base for metadata, robots.txt and the sitemap. Server-only (the variable is
 * not NEXT_PUBLIC_). Same rules as `apiOrigin`: `||` so an empty value falls back too (with
 * `??`, robots.txt named a relative sitemap), localhost for bare local tooling, and no
 * trailing slash.
 */
export function webOrigin(): string {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3001").replace(/\/+$/, "");
}
