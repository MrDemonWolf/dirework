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
  const incoming = new URL(requestUrl);
  const target = new URL(apiOrigin);
  // Assign components instead of resolving a path string. A future catch-all
  // route receiving a `//host` pathname must never reinterpret it as a new
  // authority and turn this fixed-origin proxy into SSRF.
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  target.hash = "";
  return target.toString();
}

/** Hop-by-hop / auto-computed headers the proxied fetch must not carry over. */
const STRIP_REQUEST_HEADERS = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "expect",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
];

/** Copy request headers (cookies included) minus the ones fetch derives itself. */
export function forwardHeaders(incoming: Headers): Headers {
  const headers = new Headers(incoming);
  for (const name of STRIP_REQUEST_HEADERS) headers.delete(name);
  return headers;
}

/**
 * Max bytes accepted on a proxied request body. OAuth callbacks and better-auth
 * form posts are tiny; anything larger is abuse, not a real client.
 */
export const MAX_PROXY_BODY_BYTES = 64 * 1024;

/** Seconds before we give up on the upstream api worker. */
const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Reject an over-large body BEFORE reading it, using the declared
 * Content-Length. Returns null when the request is acceptable.
 */
function checkDeclaredSize(req: Request): Response | null {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_PROXY_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  return null;
}

/** Proxy a request to the api worker and return its response untouched. */
export async function proxyToApi(req: Request): Promise<Response> {
  const tooLarge = checkDeclaredSize(req);
  if (tooLarge) return tooLarge;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  try {
    const res = await fetch(buildTargetUrl(req.url, serverUrl), {
      method: req.method,
      headers: forwardHeaders(req.headers),
      // Stream the body straight through instead of buffering it with
      // arrayBuffer() — an unbounded read let a large upload sit in worker
      // memory before we ever forwarded it. `duplex` is required when body is
      // a stream. A chunked request that lied about (or omitted) its
      // Content-Length is still bounded upstream by the server's body limit.
      body: hasBody ? req.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      // Pass 3xx (and their Set-Cookie) through to the browser untouched.
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    } as RequestInit);
    return new Response(res.body, res);
  } catch (err) {
    // Never leak the upstream URL or internal error text to the browser.
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return new Response(timedOut ? "Upstream timeout" : "Bad gateway", {
      status: timedOut ? 504 : 502,
    });
  }
}
