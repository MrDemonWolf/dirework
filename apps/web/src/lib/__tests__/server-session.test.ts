import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      cookie: "__Secure-better-auth.session_token=abc",
      "cf-connecting-ip": "203.0.113.7",
    }),
}));

import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  verifyClientIp,
} from "@dirework/api/proxy-identity";

import { getInstanceOwned, getServerSession, SessionUnavailableError } from "../server-session";

const originalFetch = globalThis.fetch;

function mockFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => impl());
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("getServerSession", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the session and forwards the request cookie", async () => {
    const session = { session: { id: "s1" }, user: { id: "u1", isOwner: true } };
    const fetchMock = mockFetch(async () => Response.json(session));

    await expect(getServerSession()).resolves.toEqual(session);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get("cookie")).toBe("__Secure-better-auth.session_token=abc");
  });

  it("forwards the browser IP signed with PROXY_SECRET (rate-limit identity)", async () => {
    vi.stubEnv("PROXY_SECRET", "s".repeat(40));
    try {
      const fetchMock = mockFetch(async () => Response.json(null));

      await getServerSession();
      await getInstanceOwned();

      for (const call of fetchMock.mock.calls) {
        const headers = new Headers(call[1]?.headers);
        expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
        expect(
          await verifyClientIp(
            "203.0.113.7",
            headers.get(CLIENT_IP_SIGNATURE_HEADER) ?? "",
            "s".repeat(40),
          ),
        ).toBe(true);
      }
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns null only for a 2xx JSON null body (genuinely signed out)", async () => {
    mockFetch(async () => Response.json(null));
    await expect(getServerSession()).resolves.toBeNull();
  });

  it.each([429, 500, 503])(
    "throws SessionUnavailableError on HTTP %i instead of looking signed out",
    async (status) => {
      mockFetch(async () => new Response("Too many requests", { status }));
      await expect(getServerSession()).rejects.toBeInstanceOf(SessionUnavailableError);
    },
  );

  it("throws SessionUnavailableError on a network failure or timeout", async () => {
    mockFetch(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });
    await expect(getServerSession()).rejects.toBeInstanceOf(SessionUnavailableError);
  });

  it("throws SessionUnavailableError on a non-JSON 2xx body", async () => {
    mockFetch(async () => new Response("<!DOCTYPE html>", { status: 200 }));
    await expect(getServerSession()).rejects.toBeInstanceOf(SessionUnavailableError);
  });
});

describe("getInstanceOwned", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each([
    [true, true],
    [false, false],
  ])("reports hasOwner=%s from the api worker", async (data, expected) => {
    mockFetch(async () => Response.json({ result: { data } }));
    await expect(getInstanceOwned()).resolves.toBe(expected);
  });

  it("fails safe to claimed on an error status, a malformed body, or a network failure", async () => {
    mockFetch(async () => new Response("down", { status: 503 }));
    await expect(getInstanceOwned()).resolves.toBe(true);
    mockFetch(async () => Response.json({}));
    await expect(getInstanceOwned()).resolves.toBe(true);
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(getInstanceOwned()).resolves.toBe(true);
  });
});
