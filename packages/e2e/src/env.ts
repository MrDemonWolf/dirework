// Fixed test-only values shared by the boot scripts, the Playwright config and the specs.
// None of them is a secret: both workers listen on loopback for the length of the run.

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`${name} must be a port number, got ${JSON.stringify(raw)}`);
  }
  return value;
}

/**
 * The api port must match the NEXT_PUBLIC_SERVER_URL the web bundle was built with: the
 * browser's direct publicTrpc calls (overlays, bot page) are baked to it. verify.yml builds
 * with http://localhost:3000. Locally, with `bun run dev` holding 3000/3001, build the bundle
 * with NEXT_PUBLIC_SERVER_URL=http://localhost:<port> and run with E2E_API_PORT / E2E_WEB_PORT.
 */
export const API_PORT = port("E2E_API_PORT", 3000);
export const WEB_PORT = port("E2E_WEB_PORT", 3001);

/** What the browser uses: cookies, CORS and the baked api origin are all keyed on these. */
export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

/** Loopback forms for the readiness probes: Node and Bun may resolve `localhost` to ::1 first. */
export const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/ready`;
/**
 * The web probe is the claim page, not `/api/version`: `/setup` renders only once the web
 * worker can reach the api (`getInstanceOwned` fails closed to "owned", which 404s it), so
 * Playwright waits until the whole web → api hop is warm. On the fresh e2e database that is
 * the only answer short of a cold-start failure; `00-first-run` then sees the real state.
 */
export const WEB_HEALTH_URL = `http://127.0.0.1:${WEB_PORT}/setup`;

/** Signs the forwarded client IP on the web → api hop; must be at least 32 characters. */
export const PROXY_SECRET = "e2e-proxy-secret-0123456789abcdef0123456789";
export const BETTER_AUTH_SECRET = "e2e-better-auth-secret-0123456789abcdef";
/** The per-run secret the DEV_LOGIN bypass demands (`x-dev-login-secret`). */
export const DEV_LOGIN_SECRET = "e2e-dev-login-secret";
