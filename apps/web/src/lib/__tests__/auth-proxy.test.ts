import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  verifyClientIp,
} from "@dirework/api/proxy-identity";

import { apiOrigin } from "../api-origin";
import {
  buildTargetUrl,
  forwardHeaders,
  MAX_PROXY_BODY_BYTES,
  MAX_RPC_BODY_BYTES,
  proxyRpcToApi,
  proxyToApi,
} from "../auth-proxy";

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

describe("proxyToApi body limits and upstream failures", () => {
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

  it("treats a non-numeric content-length as within the limit", async () => {
    const fetchSpy = vi.fn(async () => new Response("ok", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const req = new Request("https://dirework.example/api/auth/sign-in", {
      method: "POST",
      headers: { "content-length": "not-a-number" },
      body: "x",
    });

    expect((await proxyToApi(req)).status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
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

describe("proxyToApi forwards OAuth traffic verbatim", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockUpstream(response: () => Response) {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("never follows upstream redirects, so the 3xx and every Set-Cookie reach the browser", async () => {
    const fetchMock = mockUpstream(
      () =>
        new Response(null, {
          status: 302,
          headers: [
            ["location", "/dashboard"],
            ["set-cookie", "a=1"],
            ["set-cookie", "b=2"],
          ],
        }),
    );

    const res = await proxyToApi(
      new Request("https://dirework.example/api/auth/callback/twitch?code=abc&state=xyz"),
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${apiOrigin()}/api/auth/callback/twitch?code=abc&state=xyz`);
    expect(init?.redirect).toBe("manual");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(res.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
  });

  it("streams a POST body through to the upstream", async () => {
    const fetchMock = mockUpstream(() => new Response("ok"));

    await proxyToApi(
      new Request("https://dirework.example/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"hello":"world"}',
      }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { duplex?: string }) | undefined;
    expect(init).toMatchObject({ method: "POST", duplex: "half", redirect: "manual" });
    expect(await new Response(init?.body).text()).toBe('{"hello":"world"}');
  });

  it.each(["GET", "HEAD"])("sends no body for %s", async (method) => {
    const fetchMock = mockUpstream(() => new Response(null));

    await proxyToApi(new Request("https://dirework.example/api/auth/get-session", { method }));

    const init = fetchMock.mock.calls[0]?.[1] as (RequestInit & { duplex?: string }) | undefined;
    expect(init?.method).toBe(method);
    expect(init?.body).toBeUndefined();
    expect(init?.duplex).toBeUndefined();
  });
});

describe("signed client-IP forwarding (rate-limit identity)", () => {
  const originalFetch = globalThis.fetch;
  const SECRET = "s".repeat(40);
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  function mockUpstream() {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  function sentHeaders(fetchMock: ReturnType<typeof mockUpstream>) {
    return new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
  }

  it("forwards the browser IP with an HMAC the api worker verifies", async () => {
    vi.stubEnv("PROXY_SECRET", SECRET);
    const fetchMock = mockUpstream();

    await proxyToApi(
      new Request("https://dirework.example/api/auth/get-session", {
        headers: { "cf-connecting-ip": "203.0.113.7" },
      }),
    );

    const headers = sentHeaders(fetchMock);
    expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    const sig = headers.get(CLIENT_IP_SIGNATURE_HEADER) ?? "";
    expect(await verifyClientIp("203.0.113.7", sig, SECRET)).toBe(true);
    expect(await verifyClientIp("203.0.113.8", sig, SECRET)).toBe(false);
  });

  it("drops client-supplied identity headers instead of passing them on", async () => {
    vi.stubEnv("PROXY_SECRET", SECRET);
    const fetchMock = mockUpstream();

    await proxyToApi(
      new Request("https://dirework.example/api/auth/get-session", {
        headers: {
          "cf-connecting-ip": "203.0.113.7",
          [CLIENT_IP_HEADER]: "1.1.1.1",
          [CLIENT_IP_SIGNATURE_HEADER]: "forged",
        },
      }),
    );

    expect(sentHeaders(fetchMock).get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
  });

  it("forwards no identity at all without a PROXY_SECRET (local next dev)", async () => {
    vi.stubEnv("PROXY_SECRET", "");
    const fetchMock = mockUpstream();

    await proxyToApi(
      new Request("https://dirework.example/api/auth/get-session", {
        headers: {
          "cf-connecting-ip": "203.0.113.7",
          [CLIENT_IP_HEADER]: "1.1.1.1",
          [CLIENT_IP_SIGNATURE_HEADER]: "forged",
        },
      }),
    );

    const headers = sentHeaders(fetchMock);
    expect(headers.get(CLIENT_IP_HEADER)).toBeNull();
    expect(headers.get(CLIENT_IP_SIGNATURE_HEADER)).toBeNull();
  });
});

describe("proxyRpcToApi (authenticated tRPC)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps /rpc/* onto the api worker's /trpc/* keeping the batch query", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await proxyRpcToApi(
      new Request("https://dirework.example/rpc/timer.get,task.list?batch=1&input=%7B%7D", {
        headers: { cookie: "__Secure-better-auth.session_token=abc" },
      }),
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${apiOrigin()}/trpc/timer.get,task.list?batch=1&input=%7B%7D`);
    expect(new Headers(init?.headers).get("cookie")).toBe("__Secure-better-auth.session_token=abc");
  });

  it("accepts tRPC bodies up to the api worker's limit, above the OAuth limit", async () => {
    globalThis.fetch = vi.fn(async () => new Response("{}")) as unknown as typeof fetch;
    const post = (bytes: number) =>
      new Request("https://dirework.example/rpc/config.updateTimerStyle", {
        method: "POST",
        headers: { "content-length": String(bytes) },
        body: "x",
      });

    expect((await proxyRpcToApi(post(MAX_PROXY_BODY_BYTES + 1))).status).toBe(200);
    expect((await proxyRpcToApi(post(MAX_RPC_BODY_BYTES + 1))).status).toBe(413);
  });

  it("only swaps a leading /rpc segment", () => {
    expect(
      buildTargetUrl("https://dirework.example/api/rpc/x", API, { from: "/rpc", to: "/trpc" }),
    ).toBe(`${API}/api/rpc/x`);
  });
});
