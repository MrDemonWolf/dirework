import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import {
  disconnectBotAccount,
  getFreshChatToken,
  refreshBotToken,
  resolveChannelLogin,
  type TwitchCredentials,
} from "../twitch-auth";

const CREDS: TwitchCredentials = { clientId: "client-id", clientSecret: "client-secret" };

const FRESH_EXPIRY = new Date(Date.now() + 60 * 60 * 1000); // 1h out
const STALE_EXPIRY = new Date(Date.now() + 60 * 1000); // inside the 5m margin

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "singleton",
    twitchId: "111",
    username: "direbot",
    displayName: "DireBot",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: FRESH_EXPIRY,
    scopes: ["chat:read", "chat:edit"],
    ...overrides,
  };
}

interface DbOptions {
  botAccount?: Record<string, unknown>;
  instanceConfig?: Record<string, unknown>;
  updatedRow?: Record<string, unknown> | null;
}

/** Minimal drizzle-shaped mock covering findFirst / update / delete chains. */
function makeDb(opts: DbOptions = {}) {
  const returning = vi.fn(async () => (opts.updatedRow ? [opts.updatedRow] : []));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const deleteWhere = vi.fn(async () => undefined);
  const del = vi.fn(() => ({ where: deleteWhere }));

  const db = {
    query: {
      botAccount: { findFirst: async () => opts.botAccount },
      instanceConfig: { findFirst: async () => opts.instanceConfig },
    },
    update,
    delete: del,
  } as unknown as DbClient;

  return { db, update, set, returning, del, deleteWhere };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function okJson(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("refreshBotToken", () => {
  it("returns null when no bot account is connected", async () => {
    const { db } = makeDb({ botAccount: undefined });
    expect(await refreshBotToken(db, CREDS)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges the refresh token with the supplied credentials and persists the result", async () => {
    const updatedRow = makeAccount({ accessToken: "new-access" });
    const { db, set } = makeDb({ botAccount: makeAccount(), updatedRow });
    fetchMock.mockResolvedValueOnce(okJson({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
    }));

    const result = await refreshBotToken(db, CREDS);

    expect(result?.accessToken).toBe("new-access");
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(url).toBe("https://id.twitch.tv/oauth2/token");
    expect(init.body.get("client_id")).toBe("client-id");
    expect(init.body.get("client_secret")).toBe("client-secret");
    expect(init.body.get("grant_type")).toBe("refresh_token");
    expect(init.body.get("refresh_token")).toBe("old-refresh");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    }));
  });

  it("keeps the old refresh token when Twitch omits one", async () => {
    const { db, set } = makeDb({ botAccount: makeAccount(), updatedRow: makeAccount() });
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-access" }));

    await refreshBotToken(db, CREDS);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      refreshToken: "old-refresh",
    }));
  });

  it("throws UNAUTHORIZED when Twitch rejects the refresh", async () => {
    const { db } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("getFreshChatToken", () => {
  it("returns null when no bot account is connected", async () => {
    const { db } = makeDb({ botAccount: undefined });
    expect(await getFreshChatToken(db, CREDS)).toBeNull();
  });

  it("returns the stored token when it is still fresh", async () => {
    const { db } = makeDb({ botAccount: makeAccount() });
    expect(await getFreshChatToken(db, CREDS)).toBe("old-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes when the stored token is near expiry", async () => {
    const updatedRow = makeAccount({ accessToken: "new-access" });
    const { db } = makeDb({
      botAccount: makeAccount({ expiresAt: STALE_EXPIRY }),
      updatedRow,
    });
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-access", expires_in: 3600 }));

    expect(await getFreshChatToken(db, CREDS)).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forceRefresh runs the refresh flow even when the stored token looks fresh", async () => {
    const updatedRow = makeAccount({ accessToken: "new-access" });
    const { db } = makeDb({ botAccount: makeAccount(), updatedRow });
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-access", expires_in: 3600 }));

    expect(await getFreshChatToken(db, CREDS, { forceRefresh: true })).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("disconnectBotAccount", () => {
  it("revokes the access token then deletes the bot account", async () => {
    const { db, del } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: true });

    await disconnectBotAccount(db, CREDS);

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(url).toBe("https://id.twitch.tv/oauth2/revoke");
    expect(init.body.get("client_id")).toBe("client-id");
    expect(init.body.get("token")).toBe("old-access");
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("still deletes the account when revocation fails", async () => {
    const { db, del } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await disconnectBotAccount(db, CREDS);

    expect(del).toHaveBeenCalledTimes(1);
  });

  it("skips revocation when no account exists but still clears the table", async () => {
    const { db, del } = makeDb({ botAccount: undefined });

    await disconnectBotAccount(db, CREDS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledTimes(1);
  });
});

describe("resolveChannelLogin", () => {
  const helix = { clientId: "client-id", accessToken: "chat-token" };

  it("returns the cached login without hitting Helix", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: "mrdemonwolf" } });

    expect(
      await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "MrDemonWolf" }),
    ).toBe("mrdemonwolf");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the login from Helix and persists it", async () => {
    const { db, set } = makeDb({
      instanceConfig: { channelLogin: null },
      updatedRow: { channelLogin: "mrdemonwolf" },
    });
    fetchMock.mockResolvedValueOnce(okJson({ data: [{ login: "mrdemonwolf" }] }));

    expect(
      await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "MrDemonWolf" }),
    ).toBe("mrdemonwolf");

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.twitch.tv/helix/users?id=42");
    expect(init.headers.Authorization).toBe("Bearer chat-token");
    expect(init.headers["Client-Id"]).toBe("client-id");
    expect(set).toHaveBeenCalledWith({ channelLogin: "mrdemonwolf" });
  });

  it("falls back to the lowercased display name when there is no twitchId", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: null } });

    expect(
      await resolveChannelLogin(db, helix, { twitchId: null, fallbackName: "DevUser" }),
    ).toBe("devuser");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the lowercased display name when Helix errors", async () => {
    const { db, set } = makeDb({ instanceConfig: { channelLogin: null } });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    expect(
      await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "MrDemonWolf" }),
    ).toBe("mrdemonwolf");
    expect(set).not.toHaveBeenCalled();
  });

  it("falls back to the lowercased display name when Helix is unreachable", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: null } });
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    expect(
      await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "MrDemonWolf" }),
    ).toBe("mrdemonwolf");
  });
});
