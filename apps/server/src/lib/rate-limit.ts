import type { MiddlewareHandler } from "hono";

import { getRequestId } from "./logger";
import { recordMetric } from "./telemetry";

/**
 * Cloudflare rate-limit enforcement (P1.8).
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

/** The runtime shape of a Cloudflare rate-limit binding. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitBindings {
  RL_AUTH?: RateLimitBinding;
  RL_BOT?: RateLimitBinding;
  RL_TOKEN?: RateLimitBinding;
  RL_OVERLAY?: RateLimitBinding;
}

export type BucketName = keyof RateLimitBindings;

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

/**
 * Per-client key. CF-Connecting-IP is set by Cloudflare's edge and cannot be
 * spoofed by the client (unlike X-Forwarded-For, which we deliberately ignore).
 * Falls back to a constant so a missing header degrades to a global limit
 * rather than to no limit at all.
 */
export function clientKey(headers: Headers, bucket: string): string {
  const ip = headers.get("cf-connecting-ip") ?? "unknown";
  return `${bucket}:${ip}`;
}

export const rateLimiter = (): MiddlewareHandler => async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  const bucket = selectBucket(pathname);
  if (!bucket) return next();

  const binding = (c.env as RateLimitBindings | undefined)?.[bucket];
  // No binding (local dev / a deploy predating the bindings) → fail OPEN.
  // Rate limiting is an abuse brake; it must never take the app down itself.
  if (!binding) return next();

  let success: boolean;
  try {
    ({ success } = await binding.limit({ key: clientKey(c.req.raw.headers, bucket) }));
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
