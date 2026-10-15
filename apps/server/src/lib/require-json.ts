import type { MiddlewareHandler } from "hono";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reject tRPC mutations that are not `application/json`.
 *
 * Every Dirework client uses httpBatchLink, which always POSTs JSON. A
 * multipart, urlencoded or text/plain POST is a CORS "simple" request: a page
 * on any same-site origin (another worker under the same
 * `<account>.workers.dev`, or a sibling subdomain on a custom domain) could
 * send one with the owner's SameSite=Lax cookie and no preflight. Requiring
 * JSON forces a preflight, which CORS only grants to the web origin.
 */
export function requireJsonMutations(): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const contentType = c.req.header("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return c.json({ error: "Unsupported Media Type" }, 415);
    }
    return next();
  };
}
