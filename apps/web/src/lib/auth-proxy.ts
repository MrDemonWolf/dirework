/**
 * Manual same-origin proxy from the web worker to the api worker, used by the
 * OAuth routes (/api/auth/*, /api/bot/*) AND authenticated tRPC (/rpc/* →
 * /trpc/*).
 *
 * The OAuth routes CANNOT be Next rewrites: the rewrite's internal fetch
 * follows upstream 3xx responses, so the browser receives the followed page as
 * a 200 and the redirect's Set-Cookie (the better-auth session token) is
 * dropped — login "succeeds" server-side but the browser never gets a
 * session. These handlers forward the upstream response verbatim instead
 * (redirect: "manual"), preserving Location and Set-Cookie.
 *
 * /rpc was a rewrite (tRPC never redirects) but a rewrite cannot compute
 * per-request headers, and every proxied request must carry the browser's IP
 * signed with PROXY_SECRET (see @dirework/api/proxy-identity) — otherwise the
 * api rate limiter sees only the web worker's egress IP and all proxied
 * clients share one bucket.
 */

import { stampClientIp } from "@dirework/api/proxy-identity";

import { apiOrigin } from "./api-origin";

/**
 * Map an incoming web-origin URL to the same path+query on the api worker,
 * optionally swapping a path prefix (`/rpc` → `/trpc`).
 */
export function buildTargetUrl(
  requestUrl: string,
  apiOrigin: string,
  rewritePrefix?: { from: string; to: string },
): string {
  const incoming = new URL(requestUrl);
  const target = new URL(apiOrigin);
  let pathname = incoming.pathname;
  if (rewritePrefix && pathname.startsWith(rewritePrefix.from)) {
    pathname = rewritePrefix.to + pathname.slice(rewritePrefix.from.length);
  }
  // Assign components instead of resolving a path string. A future catch-all
  // route receiving a `//host` pathname must never reinterpret it as a new
  // authority and turn this fixed-origin proxy into SSRF.
  target.pathname = pathname;
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
 * The secret the client-IP stamp is signed with: a runtime worker binding
 * (OpenNext surfaces bindings on process.env), never a NEXT_PUBLIC_ build var.
 */
export function proxySecret(): string | undefined {
  return process.env.PROXY_SECRET || undefined;
}

/**
 * Headers for ANY web→api request made on behalf of a browser request: the
 * browser's IP (the web worker's own incoming CF-Connecting-IP, set by
 * Cloudflare's edge) plus its HMAC. A client-supplied copy of either header is
 * always discarded first.
 */
export async function stampForwardedClient(outgoing: Headers, incoming: Headers) {
  return stampClientIp(outgoing, incoming.get("cf-connecting-ip"), proxySecret());
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
function checkDeclaredSize(req: Request, maxBodyBytes: number): Response | null {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    return new Response("Payload too large", { status: 413 });
  }
  return null;
}

/**
 * Max bytes on a proxied /rpc body — the api worker's own global body limit
 * (apps/server MAX_BODY_BYTES), since theme-config saves are larger than an
 * OAuth form post. The api worker enforces it again regardless.
 */
export const MAX_RPC_BODY_BYTES = 128 * 1024;

interface ProxyOptions {
  maxBodyBytes?: number;
  rewritePrefix?: { from: string; to: string };
}

/** Build a route handler that proxies to the api worker and returns its response untouched. */
export function createApiProxy({
  maxBodyBytes = MAX_PROXY_BODY_BYTES,
  rewritePrefix,
}: ProxyOptions = {}) {
  return async (req: Request): Promise<Response> => forward(req, maxBodyBytes, rewritePrefix);
}

/** Proxy an OAuth request to the api worker and return its response untouched. */
export const proxyToApi = createApiProxy();

/** Authenticated tRPC: browser /rpc/* → api /trpc/*. */
export const proxyRpcToApi = createApiProxy({
  maxBodyBytes: MAX_RPC_BODY_BYTES,
  rewritePrefix: { from: "/rpc", to: "/trpc" },
});

async function forward(
  req: Request,
  maxBodyBytes: number,
  rewritePrefix: ProxyOptions["rewritePrefix"],
): Promise<Response> {
  const tooLarge = checkDeclaredSize(req, maxBodyBytes);
  if (tooLarge) return tooLarge;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  try {
    const headers = await stampForwardedClient(forwardHeaders(req.headers), req.headers);
    const res = await fetch(buildTargetUrl(req.url, apiOrigin(), rewritePrefix), {
      method: req.method,
      headers,
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
