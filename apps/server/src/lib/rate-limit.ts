import type { MiddlewareHandler } from "hono";

import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  verifyClientIp,
} from "@dirework/api/proxy-identity";

import { getRequestId } from "./logger";
import { sessionKeyId, verifiedSessionToken } from "./session-cookie";
import { recordMetric } from "./telemetry";

/**
 * Cloudflare rate-limit enforcement.
 *
 * The public surface here is token-gated but otherwise unauthenticated —
 * overlay polling, the bot page bootstrap, and chat ingest — so without a limiter
 * the 32-char tokens are brute-forceable and ingest is a free amplification
 * point. Buckets are separate per concern so a flood against one (say chat
 * ingest) can never starve another (overlay polling, which OBS depends on).
 *
 * Cloudflare's limiter is per-colo and best-effort — it is a blunt abuse brake,
 * not an exact quota. That is the right shape for this: legitimate traffic for a
 * single streamer sits far below every limit.
 */

/**
 * Bucket names, checked against the Env inferred from alchemy.run.ts (a
 * type-only reference — nothing from cloudflare:workers loads at runtime), so
 * renaming or dropping a binding there is a type error here instead of a
 * silent fail-open.
 */
const BUCKETS = [
  "RL_AUTH",
  "RL_BOT",
  "RL_TOKEN",
  "RL_OVERLAY",
] as const satisfies readonly (keyof Env)[];

export type BucketName = (typeof BUCKETS)[number];

/**
 * The inferred bindings, optional at runtime: tests inject them, and local dev
 * may lack them.
 */
export type RateLimitBindings = Partial<Pick<Env, BucketName>>;

/**
 * Choose the bucket for a request path. Returns null for paths that should not
 * be limited (the liveness and root probes).
 *
 * tRPC batching means a path can carry several procedures
 * (`/trpc/bot.ingest,bot.getSession`), so this matches on procedure names
 * appearing anywhere in the path and takes the most restrictive match.
 */
export function selectBucket(pathname: string): BucketName | null {
  if (pathname === "/health" || pathname === "/") return null;

  // OAuth + session endpoints: brute-force and callback-replay surface.
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/bot")) {
    return "RL_AUTH";
  }

  if (pathname.startsWith("/trpc")) {
    // Overlay polling is checked FIRST and gets its own generous bucket so OBS
    // sources keep rendering even while another bucket is saturated.
    if (pathname.includes("overlay.")) return "RL_OVERLAY";
    if (pathname.includes("bot.")) return "RL_BOT";
    // Remaining token-gated / unauthenticated reads (e.g. user.hasOwner).
    return "RL_TOKEN";
  }

  return "RL_TOKEN";
}

/** The secrets the key resolution needs; absent ones just disable that tier. */
export interface ClientKeySecrets {
  /** Verifies the better-auth session cookie signature. */
  BETTER_AUTH_SECRET?: string;
  /** Verifies the web worker's forwarded client IP (see proxy-identity.ts). */
  PROXY_SECRET?: string;
}

/**
 * Per-client key, most specific trustworthy identity first:
 *
 * 1. `session:<hash>` — a better-auth session cookie whose HMAC signature
 *    verifies (offline, see session-cookie.ts). The owner's own traffic gets
 *    its own bucket, so nobody else can drain it. A forged/random cookie fails
 *    verification and drops to tier 2/3 — it can't mint fresh buckets.
 * 2. `ip:<forwarded>` — the browser IP the web worker forwarded, trusted ONLY
 *    when its PROXY_SECRET HMAC verifies. Without this every proxied request
 *    would key on the web worker's egress IP: one shared global bucket.
 * 3. `ip:<CF-Connecting-IP>` — set by Cloudflare's edge, unspoofable by the
 *    client (unlike X-Forwarded-For, which we deliberately ignore). Direct
 *    traffic (overlays, bot page) lands here.
 *
 * Falls back to a constant so a missing header degrades to a global limit
 * rather than to no limit at all.
 */
export async function clientKey(
  headers: Headers,
  bucket: string,
  secrets: ClientKeySecrets = {},
): Promise<string> {
  const token = await verifiedSessionToken(headers, secrets.BETTER_AUTH_SECRET);
  if (token) return `${bucket}:session:${await sessionKeyId(token)}`;

  const forwarded = headers.get(CLIENT_IP_HEADER);
  const signature = headers.get(CLIENT_IP_SIGNATURE_HEADER);
  if (
    forwarded &&
    signature &&
    secrets.PROXY_SECRET &&
    (await verifyClientIp(forwarded, signature, secrets.PROXY_SECRET))
  ) {
    return `${bucket}:ip:${forwarded}`;
  }

  const ip = headers.get("cf-connecting-ip") ?? "unknown";
  return `${bucket}:ip:${ip}`;
}

export const rateLimiter = (): MiddlewareHandler => async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  const bucket = selectBucket(pathname);
  if (!bucket) return next();

  const binding = (c.env as RateLimitBindings | undefined)?.[bucket];
  // No binding (local dev / a deploy predating the bindings) → fail OPEN.
  // Rate limiting is an abuse brake; it must never take the app down itself.
  // Still counted, so a deploy that lost its bindings is visible in telemetry.
  if (!binding) {
    recordMetric("ratelimit.failure", { requestId: getRequestId(c), label: `${bucket}:missing` });
    return next();
  }

  let success: boolean;
  try {
    const key = await clientKey(c.req.raw.headers, bucket, c.env as ClientKeySecrets | undefined);
    ({ success } = await binding.limit({ key }));
  } catch {
    // Cloudflare limiter availability must never become API availability. The
    // fixed bucket label is safe; the client key (and its IP) is never logged.
    recordMetric("ratelimit.failure", { requestId: getRequestId(c), label: bucket });
    return next();
  }
  if (!success) {
    // Counter carries the BUCKET (a fixed, non-identifying name) so a flood is
    // visible in telemetry — never the client key, which contains an IP.
    recordMetric("ratelimit.rejected", { requestId: getRequestId(c), label: bucket });
    // The response says nothing about which bucket or what the limit is — that
    // only helps someone tuning an attack.
    return c.json({ error: "Too many requests" }, 429);
  }

  return next();
};
