import { describe, expect, it, vi } from "vitest";

import { CLIENT_IP_SIGNATURE_HEADER, stampClientIp } from "@dirework/api/proxy-identity";
import { makeSignature } from "better-auth/crypto";

import { clientKey, rateLimiter, selectBucket } from "../rate-limit";

describe("selectBucket", () => {
  it("keeps liveness and root probes open but limits readiness reads", () => {
    expect(selectBucket("/health")).toBeNull();
    expect(selectBucket("/ready")).toBe("RL_TOKEN");
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
  const AUTH_SECRET = "a".repeat(40);
  const PROXY_SECRET = "p".repeat(40);
  const secrets = { BETTER_AUTH_SECRET: AUTH_SECRET, PROXY_SECRET };

  /** A session cookie signed exactly the way better-auth signs it. */
  async function sessionCookie(token: string, secret = AUTH_SECRET) {
    const value = encodeURIComponent(`${token}.${await makeSignature(token, secret)}`);
    return `__Secure-better-auth.session_token=${value}`;
  }

  it("keys on the Cloudflare-set client IP", async () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7" });
    expect(await clientKey(headers, "RL_BOT")).toBe("RL_BOT:ip:203.0.113.7");
  });

  it("ignores a client-supplied X-Forwarded-For", async () => {
    // XFF is attacker-controlled; trusting it would let one client masquerade
    // as unlimited distinct clients and bypass the limiter entirely.
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
    expect(await clientKey(headers, "RL_BOT", secrets)).toBe("RL_BOT:ip:unknown");
  });

  it("namespaces the key per bucket", async () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7" });
    expect(await clientKey(headers, "RL_AUTH")).not.toBe(await clientKey(headers, "RL_BOT"));
  });

  it("trusts the web worker's forwarded IP only with a valid PROXY_SECRET signature", async () => {
    const headers = await stampClientIp(
      new Headers({ "cf-connecting-ip": "198.51.100.1" }), // the web worker's egress
      "203.0.113.7",
      PROXY_SECRET,
    );
    expect(await clientKey(headers, "RL_TOKEN", secrets)).toBe("RL_TOKEN:ip:203.0.113.7");
  });

  it.each([
    ["a forged signature", "AAAA"],
    ["a signature made with another secret", null],
  ])("falls back to CF-Connecting-IP for %s", async (_label, forged) => {
    const headers = new Headers({ "cf-connecting-ip": "198.51.100.1" });
    await stampClientIp(headers, "203.0.113.7", "x".repeat(40));
    if (forged) headers.set(CLIENT_IP_SIGNATURE_HEADER, forged);
    expect(await clientKey(headers, "RL_TOKEN", secrets)).toBe("RL_TOKEN:ip:198.51.100.1");
  });

  it("does not trust a forwarded IP when the api worker has no PROXY_SECRET", async () => {
    const headers = await stampClientIp(
      new Headers({ "cf-connecting-ip": "198.51.100.1" }),
      "203.0.113.7",
      PROXY_SECRET,
    );
    expect(await clientKey(headers, "RL_TOKEN", { BETTER_AUTH_SECRET: AUTH_SECRET })).toBe(
      "RL_TOKEN:ip:198.51.100.1",
    );
  });

  it("keys a correctly signed session cookie by a hash of the session token", async () => {
    const headers = new Headers({
      cookie: `theme=dark; ${await sessionCookie("session-token-1")}`,
      "cf-connecting-ip": "198.51.100.1",
    });
    const key = await clientKey(headers, "RL_TOKEN", secrets);
    expect(key).toMatch(/^RL_TOKEN:session:[0-9a-f]{32}$/);
    // The raw token never becomes (part of) the key.
    expect(key).not.toContain("session-token-1");

    const other = new Headers({ cookie: await sessionCookie("session-token-2") });
    expect(await clientKey(other, "RL_TOKEN", secrets)).not.toBe(key);
  });

  it.each([
    ["an unsigned random cookie", async () => "__Secure-better-auth.session_token=random-value"],
    ["a cookie signed with another secret", () => sessionCookie("tok", "z".repeat(40))],
    [
      "a tampered token",
      async () => (await sessionCookie("tok")).replace("session_token=tok", "session_token=tak"),
    ],
  ])("never mints a session bucket for %s", async (_label, makeCookie) => {
    // The limiter runs before better-auth: an attacker rotating fake cookies
    // must stay in their IP bucket, not get a fresh bucket per request.
    const headers = new Headers({ cookie: await makeCookie(), "cf-connecting-ip": "203.0.113.9" });
    expect(await clientKey(headers, "RL_AUTH", secrets)).toBe("RL_AUTH:ip:203.0.113.9");
  });

  it("ignores session cookies when BETTER_AUTH_SECRET is not bound", async () => {
    const headers = new Headers({
      cookie: await sessionCookie("tok"),
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(await clientKey(headers, "RL_AUTH", { PROXY_SECRET })).toBe("RL_AUTH:ip:203.0.113.9");
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

  it("keys proxied requests on the signed browser IP from the worker env", async () => {
    const limit = vi.fn(async (_opts: { key: string }) => ({ success: true }));
    const secret = "p".repeat(40);
    const headers = await stampClientIp(
      new Headers({ "cf-connecting-ip": "198.51.100.1" }),
      "203.0.113.7",
      secret,
    );
    const ctx = makeCtx(
      "https://api.test/trpc/timer.get",
      { RL_TOKEN: { limit }, PROXY_SECRET: secret },
      Object.fromEntries(headers),
    );

    await rateLimiter()(
      ctx as never,
      vi.fn(async () => undefined),
    );

    expect(limit).toHaveBeenCalledWith({ key: "RL_TOKEN:ip:203.0.113.7" });
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

  it("fails OPEN when the binding throws", async () => {
    const next = vi.fn(async () => undefined);
    const ctx = makeCtx("https://api.test/trpc/bot.ingest", {
      RL_BOT: { limit: async () => Promise.reject(new Error("binding unavailable")) },
    });

    await rateLimiter()(ctx as never, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("fails OPEN when the binding is absent (local dev)", async () => {
    // A missing binding must not take the API down — the limiter is a brake,
    // not a dependency.
    const next = vi.fn(async () => undefined);
    const ctx = makeCtx("https://api.test/trpc/bot.ingest", {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await rateLimiter()(ctx as never, next);

    expect(next).toHaveBeenCalledOnce();
    // ...but a deploy that lost its bindings must still show up in telemetry.
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      metric: "ratelimit.failure",
      label: "RL_BOT:missing",
      requestId: "test-request-id",
    });
    log.mockRestore();
  });
});
