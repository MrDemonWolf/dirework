/**
 * Manual same-origin proxy for the api worker's OAuth routes (/api/auth/*,
 * /api/bot/*).
 *
 * These CANNOT be Next rewrites: the rewrite's internal fetch follows
 * upstream 3xx responses, so the browser receives the followed page as a
 * 200 and the redirect's Set-Cookie (the better-auth session token) is
 * dropped — login "succeeds" server-side but the browser never gets a
 * session. These handlers forward the upstream response verbatim instead
 * (redirect: "manual"), preserving Location and Set-Cookie.
 */

// `||` not `??`: an empty NEXT_PUBLIC_SERVER_URL (unset GH deploy var) would
// slip past `??` and make every proxied request target the web origin itself.
const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

/** Map an incoming web-origin URL to the same path+query on the api worker. */
export function buildTargetUrl(requestUrl: string, apiOrigin: string): string {
  const url = new URL(requestUrl);
  return new URL(url.pathname + url.search, apiOrigin).toString();
}

/** Hop-by-hop / auto-computed headers the proxied fetch must not carry over. */
const STRIP_REQUEST_HEADERS = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "expect",
];

/** Copy request headers (cookies included) minus the ones fetch derives itself. */
export function forwardHeaders(incoming: Headers): Headers {
  const headers = new Headers(incoming);
  for (const name of STRIP_REQUEST_HEADERS) headers.delete(name);
  return headers;
}

/** Proxy a request to the api worker and return its response untouched. */
export async function proxyToApi(req: Request): Promise<Response> {
  const res = await fetch(buildTargetUrl(req.url, serverUrl), {
    method: req.method,
    headers: forwardHeaders(req.headers),
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await req.arrayBuffer(),
    // Pass 3xx (and their Set-Cookie) through to the browser untouched.
    redirect: "manual",
  });
  return new Response(res.body, res);
}
