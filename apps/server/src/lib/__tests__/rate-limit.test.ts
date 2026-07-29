import { describe, expect, it, vi } from "vitest";

import { clientKey, rateLimiter, selectBucket } from "../rate-limit";

describe("selectBucket", () => {
  it("does not limit health or root probes", () => {
    expect(selectBucket("/health")).toBeNull();
    expect(selectBucket("/")).toBeNull();
  });

  it("routes auth and bot OAuth to the auth bucket", () => {
    expect(selectBucket("/api/auth/callback/twitch")).toBe("RL_AUTH");
    expect(selectBucket("/api/bot/authorize")).toBe("RL_AUTH");
  });

  it("gives overlay polling its own bucket", () => {
    expect(selectBucket("/trpc/overlay.getTimerState")).toBe("RL_OVERLAY");
    expect(selectBucket("/trpc/overlay.getTaskList")).toBe("RL_OVERLAY");
  });

  it("routes bot procedures to the bot bucket", () => {
    expect(selectBucket("/trpc/bot.ingest")).toBe("RL_BOT");
    expect(selectBucket("/trpc/bot.getSession")).toBe("RL_BOT");
  });

  it("prefers the overlay bucket in a batched request containing overlay calls", () => {
    // httpBatchLink can pack several procedures into one path; overlay polling
    // must keep its own generous budget rather than fall into a tighter bucket.
    expect(selectBucket("/trpc/overlay.getTimerState,bot.ingest")).toBe("RL_OVERLAY");
  });

  it("falls back to the token bucket for other tRPC paths", () => {
    expect(selectBucket("/trpc/user.hasOwner")).toBe("RL_TOKEN");
  });
});

describe("clientKey", () => {
  it("keys on the Cloudflare-set client IP", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7" });
    expect(clientKey(headers, "RL_BOT")).toBe("RL_BOT:203.0.113.7");
  });

  it("ignores a client-supplied X-Forwarded-For", () => {
    // XFF is attacker-controlled; trusting it would let one client masquerade
    // as unlimited distinct clients and bypass the limiter entirely.
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
    expect(clientKey(headers, "RL_BOT")).toBe("RL_BOT:unknown");
  });

  it("namespaces the key per bucket", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7" });
    expect(clientKey(headers, "RL_AUTH")).not.toBe(clientKey(headers, "RL_BOT"));
  });
});

/** Minimal Hono-ish context for exercising the middleware directly. */
function makeCtx(url: string, env: Record<string, unknown>, headers: Record<string, string> = {}) {
  // `get` mirrors Hono's context store, where the logger middleware stashes the
  // request id — the limiter reads it from there rather than from c.res, which
  // does not exist yet at middleware time.
  const store: Record<string, unknown> = { requestId: "test-request-id" };
  return {
    req: { url, raw: { headers: new Headers(headers) } },
    env,
    get: (key: string) => store[key],
    json: (body: unknown, status: number) => ({ body, status }),
  };
}

describe("rateLimiter middleware", () => {
  it("passes the request through when under the limit", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const next = vi.fn(async () => undefined);
    const ctx = makeCtx("https://api.test/trpc/bot.ingest", { RL_BOT: { limit } });

    await rateLimiter()(ctx as never, next);

    expect(limit).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 429 without calling the handler when over the limit", async () => {
    const next = vi.fn(async () => undefined);
    const ctx = makeCtx("https://api.test/trpc/bot.ingest", {
      RL_BOT: { limit: async () => ({ success: false }) },
    });

    const res = (await rateLimiter()(ctx as never, next)) as { body: unknown; status: number };

    expect(res.status).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("leaks no bucket or limit detail in the 429 body", async () => {
    const ctx = makeCtx("https://api.test/trpc/bot.ingest", {
      RL_BOT: { limit: async () => ({ success: false }) },
    });
    const res = (await rateLimiter()(ctx as never, vi.fn())) as { body: unknown };
    expect(JSON.stringify(res.body)).not.toMatch(/RL_|bucket|namespace|\d{2,}/);
  });

  it("skips the limiter entirely for /health", async () => {
    const limit = vi.fn();
    const next = vi.fn(async () => undefined);
    const ctx = makeCtx("https://api.test/health", { RL_TOKEN: { limit } });

    await rateLimiter()(ctx as never, next);

    expect(limit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("fails OPEN when the binding is absent (local dev)", async () => {
    // A missing binding must not take the API down — the limiter is a brake,
    // not a dependency.
    const next = vi.fn(async () => undefined);
    const ctx = makeCtx("https://api.test/trpc/bot.ingest", {});

    await rateLimiter()(ctx as never, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
