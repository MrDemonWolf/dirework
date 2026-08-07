import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTargetUrl, forwardHeaders, MAX_PROXY_BODY_BYTES, proxyToApi } from "../auth-proxy";

const API = "https://dirework-api.mrdemonwolf.workers.dev";

describe("buildTargetUrl", () => {
  it("maps path + query onto the api origin", () => {
    expect(
      buildTargetUrl(
        "https://dirework.mrdemonwolf.workers.dev/api/auth/callback/twitch?code=abc&state=xyz",
        API,
      ),
    ).toBe(`${API}/api/auth/callback/twitch?code=abc&state=xyz`);
  });

  it("preserves encoded query characters (OAuth scopes)", () => {
    expect(
      buildTargetUrl(
        "https://dirework.mrdemonwolf.workers.dev/api/auth/callback/twitch?scope=user%3Aread%3Aemail+openid",
        API,
      ),
    ).toBe(`${API}/api/auth/callback/twitch?scope=user%3Aread%3Aemail+openid`);
  });

  it("never treats a double-slash pathname as a new authority", () => {
    expect(buildTargetUrl("https://dirework.example//attacker.example/steal", API)).toBe(
      `${API}//attacker.example/steal`,
    );
  });

  it("handles paths without a query string", () => {
    expect(buildTargetUrl("http://localhost:3001/api/bot/authorize", "http://localhost:3000")).toBe(
      "http://localhost:3000/api/bot/authorize",
    );
  });
});

describe("forwardHeaders", () => {
  it("keeps cookies and content-type, strips host and content-length", () => {
    const headers = forwardHeaders(
      new Headers({
        cookie: "__Secure-better-auth.state=abc",
        "content-type": "application/json",
        host: "dirework.mrdemonwolf.workers.dev",
        "content-length": "42",
        connection: "keep-alive",
        forwarded: "host=attacker.example;proto=http",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "http",
      }),
    );
    expect(headers.get("cookie")).toBe("__Secure-better-auth.state=abc");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("host")).toBeNull();
    expect(headers.get("content-length")).toBeNull();
    expect(headers.get("connection")).toBeNull();
    expect(headers.get("forwarded")).toBeNull();
    expect(headers.get("x-forwarded-host")).toBeNull();
    expect(headers.get("x-forwarded-proto")).toBeNull();
  });
});

describe("proxyToApi body limits and upstream failures (P1.8)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects an over-large declared body with 413 before contacting upstream", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const req = new Request("https://dirework.example/api/auth/sign-in", {
      method: "POST",
      headers: { "content-length": String(MAX_PROXY_BODY_BYTES + 1) },
      body: "x",
    });

    const res = await proxyToApi(req);

    expect(res.status).toBe(413);
    // The whole point: we must not read or forward the oversized body.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a body at exactly the limit", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("ok", { status: 200 }),
    ) as unknown as typeof fetch;

    const req = new Request("https://dirework.example/api/auth/sign-in", {
      method: "POST",
      headers: { "content-length": String(MAX_PROXY_BODY_BYTES) },
      body: "x",
    });

    expect((await proxyToApi(req)).status).toBe(200);
  });

  it("maps an upstream timeout to 504 without leaking internals", async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;

    const res = await proxyToApi(new Request("https://dirework.example/api/auth/session"));

    expect(res.status).toBe(504);
    const body = await res.text();
    expect(body).not.toMatch(/localhost|workers\.dev|http/);
  });

  it("maps other upstream failures to 502 without leaking the target URL", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED http://localhost:3000");
    }) as unknown as typeof fetch;

    const res = await proxyToApi(new Request("https://dirework.example/api/auth/session"));

    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/localhost|ECONNREFUSED/);
  });
});
