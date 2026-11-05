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

const AVATAR = "https://static-cdn.jtvnw.net/jtv_user_pictures/wolf-profile_image-300x300.png";

/**
 * A get-session body the way better-auth 1.7 sends it with `disableRefresh`
 * (dist/api/routes/session.mjs): the whole session row, token included, plus the user row.
 */
function getSessionBody(user: Record<string, unknown> = {}) {
  return {
    session: {
      id: "sess-row-7f3a",
      token: "tok-secret-9q2w",
      userId: "user-row-4c1d",
      expiresAt: "2026-12-04T12:00:00.000Z",
      createdAt: "2026-11-04T12:00:00.000Z",
      updatedAt: "2026-11-04T12:00:00.000Z",
      // Nulled at sign-in today, but rows written by an older build could still carry them.
      ipAddress: "198.51.100.23",
      userAgent: "LeakProbe/1.0",
    },
    user: {
      id: "user-row-4c1d",
      name: "wolfstreams",
      email: "8675309@users.twitch.invalid",
      emailVerified: false,
      image: AVATAR,
      twitchId: "8675309",
      displayName: "WolfStreams",
      isOwner: true,
      createdAt: "2026-11-04T12:00:00.000Z",
      updatedAt: "2026-11-04T12:00:00.000Z",
      ...user,
    },
  };
}

describe("getServerSession", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the user fields the UI reads and forwards the request cookie", async () => {
    const fetchMock = mockFetch(async () => Response.json(getSessionBody()));

    await expect(getServerSession()).resolves.toStrictEqual({
      user: { name: "wolfstreams", image: AVATAR, isOwner: true },
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get("cookie")).toBe("__Secure-better-auth.session_token=abc");
  });

  it("never hands pages the session token, session id, IP, user agent or email", async () => {
    // Pages pass this object to client components (Header, UserMenu, Dashboard), and their
    // props are serialized into the RSC payload: the token the HttpOnly cookie keeps away
    // from scripts must not ride along.
    mockFetch(async () => Response.json(getSessionBody()));

    const serialized = JSON.stringify(await getServerSession());
    for (const leak of [
      "tok-secret-9q2w",
      "sess-row-7f3a",
      "user-row-4c1d",
      "198.51.100.23",
      "LeakProbe",
      "users.twitch.invalid",
      "8675309",
      "expiresAt",
    ]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("fills a missing name or avatar and reads ownership only from a JSON true", async () => {
    mockFetch(async () =>
      Response.json(getSessionBody({ name: undefined, image: undefined, isOwner: "true" })),
    );
    await expect(getServerSession()).resolves.toStrictEqual({
      user: { name: "", image: null, isOwner: false },
    });
  });

  it.each([
    ["no user", { session: { token: "tok-secret-9q2w" } }],
    ["a null user", { session: {}, user: null }],
    ["a bare string", "signed-in"],
  ])("throws SessionUnavailableError on a 2xx body with %s", async (_label, body) => {
    mockFetch(async () => Response.json(body));
    await expect(getServerSession()).rejects.toBeInstanceOf(SessionUnavailableError);
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
