import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import {
  BOT_REAUTH_REQUIRED_MESSAGE,
  disconnectBotAccount,
  getFreshChatToken,
  refreshBotToken,
  resolveChannelLogin,
  validateChatToken,
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
  let lastSet: Record<string, unknown> | null = null;
  // The refresh flow issues TWO updates: a lease-acquire CAS (set carries only
  // refreshLockedUntil, no tokens) and the token persist (carries accessToken).
  // The lease CAS must "succeed" (return the account row) so the caller proceeds
  // to the Twitch exchange; the persist returns the caller-supplied updatedRow.
  const returning = vi.fn(async () => {
    const isLeaseAcquire =
      !!lastSet && "refreshLockedUntil" in lastSet && !("accessToken" in lastSet);
    if (isLeaseAcquire) return opts.botAccount ? [opts.botAccount] : [];
    return opts.updatedRow ? [opts.updatedRow] : [];
  });
  const where = vi.fn((_condition?: SQL) => ({ returning }));
  const set = vi.fn((v: Record<string, unknown>) => {
    lastSet = v;
    return { where };
  });
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

  return { db, update, set, where, returning, del, deleteWhere };
}

/** Render a captured drizzle WHERE condition to SQL text + params. */
function renderWhere(condition: unknown) {
  return new SQLiteSyncDialect().sqlToQuery(condition as SQL);
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
    fetchMock.mockResolvedValueOnce(
      okJson({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
      }),
    );

    const result = await refreshBotToken(db, CREDS);

    expect(result?.accessToken).toBe("new-access");
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(url).toBe("https://id.twitch.tv/oauth2/token");
    expect(init.body.get("client_id")).toBe("client-id");
    expect(init.body.get("client_secret")).toBe("client-secret");
    expect(init.body.get("grant_type")).toBe("refresh_token");
    expect(init.body.get("refresh_token")).toBe("old-refresh");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      }),
    );
  });

  it("keeps the old refresh token when Twitch omits one", async () => {
    const { db, set } = makeDb({ botAccount: makeAccount(), updatedRow: makeAccount() });
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-access" }));

    await refreshBotToken(db, CREDS);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: "old-refresh",
      }),
    );
  });

  it.each([400, 401, 403])(
    "throws PRECONDITION_FAILED (reconnect needed) when Twitch rejects the refresh with %i",
    async (status) => {
      const { db } = makeDb({ botAccount: makeAccount() });
      fetchMock.mockResolvedValueOnce({ ok: false, status });

      // The bot page matches on this exact message (classifyBotError) to show
      // the reconnect screen instead of retrying forever.
      await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: BOT_REAUTH_REQUIRED_MESSAGE,
      });
    },
  );

  it.each([429, 500, 503])(
    "throws SERVICE_UNAVAILABLE (transient) when Twitch answers %i",
    async (status) => {
      const { db } = makeDb({ botAccount: makeAccount() });
      fetchMock.mockResolvedValueOnce({ ok: false, status });

      await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    },
  );

  it("throws SERVICE_UNAVAILABLE and releases the lease when Twitch is unreachable", async () => {
    const { db, set } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(set).toHaveBeenLastCalledWith({ refreshLockedUntil: null });
  });

  it("releases the lease when Twitch rejects the refresh", async () => {
    const { db, update, set } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: BOT_REAUTH_REQUIRED_MESSAGE,
    });
    // Acquire, then release — a failed refresh must not block the next attempt.
    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith({ refreshLockedUntil: null });
  });

  it("releases the lease when Twitch returns an unusable token response", async () => {
    for (const response of [
      { ok: true, json: async () => Promise.reject(new Error("bad json")) },
      okJson({ access_token: "" }),
    ]) {
      const { db, update, set } = makeDb({ botAccount: makeAccount() });
      fetchMock.mockResolvedValueOnce(response);

      await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
      expect(update).toHaveBeenCalledTimes(2);
      expect(set).toHaveBeenLastCalledWith({ refreshLockedUntil: null });
    }
  });

  it("acquires the lease only when it is free or expired", async () => {
    const { db, where } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
    const before = Date.now();

    await refreshBotToken(db, CREDS).catch(() => undefined);

    const lease = renderWhere(where.mock.calls[0]?.[0]);
    // Without the expiry clause one crashed refresh would hold the lease forever.
    expect(lease.sql).toContain('"refresh_locked_until" is null');
    expect(lease.sql).toContain('"refresh_locked_until" < ?');
    const [, lockedBefore] = lease.params as [string, number];
    expect(lockedBefore).toBeGreaterThanOrEqual(before);
    expect(lockedBefore).toBeLessThanOrEqual(Date.now());
  });

  it("spends the refresh token as of the lease, not the pre-lease read", async () => {
    // Another refresh committed between our read and our lease: the row we
    // leased already carries the rotated token, and the old one is dead.
    const leasedRow = makeAccount({ refreshToken: "rotated-refresh" });
    const findFirst = vi.fn(async () => makeAccount());
    const sets: Record<string, unknown>[] = [];
    const wheres: unknown[] = [];
    const db = {
      query: { botAccount: { findFirst } },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return {
            where: (condition: unknown) => {
              wheres.push(condition);
              return { returning: async () => [{ ...leasedRow, ...values }] };
            },
          };
        },
      }),
    } as unknown as DbClient;
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-access", expires_in: 3600 }));

    await refreshBotToken(db, CREDS);

    const [, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(init.body.get("refresh_token")).toBe("rotated-refresh");
    expect(sets[1]).toMatchObject({ refreshToken: "rotated-refresh" });
    // The persist is conditional on the token we spent.
    expect(renderWhere(wheres[1]).params).toContain("rotated-refresh");
  });

  it("does not overwrite tokens that changed while it held the lease", async () => {
    const current = makeAccount({ accessToken: "someone-else", refreshToken: "newer-refresh" });
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(makeAccount()) // pre-lease read
      .mockResolvedValue(current); // re-read after the conditional persist missed
    const sets: Record<string, unknown>[] = [];
    let call = 0;
    const db = {
      query: { botAccount: { findFirst } },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          call += 1;
          const rows = call === 1 ? [makeAccount()] : [];
          return { where: () => ({ returning: async () => rows }) };
        },
      }),
    } as unknown as DbClient;
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-access", expires_in: 3600 }));

    const result = await refreshBotToken(db, CREDS);

    expect(result).toBe(current);
    // acquire → conditional persist (missed) → release
    expect(sets).toHaveLength(3);
    expect(sets[2]).toEqual({ refreshLockedUntil: null });
  });

  it("persists the rotated refresh token and releases the lease", async () => {
    const { db, set } = makeDb({
      botAccount: makeAccount(),
      updatedRow: makeAccount({ accessToken: "new-access", refreshToken: "rotated-refresh" }),
    });
    fetchMock.mockResolvedValueOnce(
      okJson({
        access_token: "new-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
      }),
    );

    await refreshBotToken(db, CREDS);

    // The token persist rotates the refresh token AND clears the lease.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "new-access",
        refreshToken: "rotated-refresh",
        refreshLockedUntil: null,
      }),
    );
  });

  it("serializes concurrent refreshes: a loser waits for the winner, not Twitch", async () => {
    vi.useFakeTimers();
    try {
      const rotated = makeAccount({
        accessToken: "winner-access",
        refreshToken: "rotated-refresh",
        refreshLockedUntil: null,
      });
      let reads = 0;
      const findFirst = vi.fn(async () => {
        reads += 1;
        // First read = pre-refresh state; later reads = winner's rotated row.
        return reads === 1 ? makeAccount() : rotated;
      });
      // Lease CAS acquires nothing → this caller is the loser.
      const returning = vi.fn(async () => [] as unknown[]);
      const db = {
        query: { botAccount: { findFirst } },
        update: () => ({ set: () => ({ where: () => ({ returning }) }) }),
      } as unknown as DbClient;

      const promise = refreshBotToken(db, CREDS);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(fetchMock).not.toHaveBeenCalled(); // never fired a 2nd refresh
      expect(result?.accessToken).toBe("winner-access");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a loser accepts a winner that kept the same refresh token", async () => {
    vi.useFakeTimers();
    try {
      // Twitch may return no new refresh token: only the access token changes.
      const published = makeAccount({ accessToken: "winner-access", refreshLockedUntil: null });
      const findFirst = vi.fn().mockResolvedValueOnce(makeAccount()).mockResolvedValue(published);
      const db = {
        query: { botAccount: { findFirst } },
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      } as unknown as DbClient;

      const promise = refreshBotToken(db, CREDS);
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result?.accessToken).toBe("winner-access");
      expect(findFirst).toHaveBeenCalledTimes(2); // returned on the first poll
    } finally {
      vi.useRealTimers();
    }
  });

  it("a loser whose holder failed stops waiting and surfaces the real failure", async () => {
    vi.useFakeTimers();
    try {
      // The holder's refresh failed: lease released, every token unchanged.
      const released = makeAccount({ refreshLockedUntil: null });
      const findFirst = vi.fn().mockResolvedValueOnce(makeAccount()).mockResolvedValue(released);
      let cas = 0;
      const sets: Record<string, unknown>[] = [];
      const db = {
        query: { botAccount: { findFirst } },
        update: () => ({
          set: (values: Record<string, unknown>) => {
            sets.push(values);
            const isAcquire = values.refreshLockedUntil instanceof Date;
            if (isAcquire) cas += 1;
            // First CAS loses (holder in flight); the retry acquires.
            const rows = isAcquire && cas === 2 ? [released] : [];
            return { where: () => ({ returning: async () => rows }) };
          },
        }),
      } as unknown as DbClient;
      // Twitch rejects the (already rejected) refresh token again → reauth.
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

      const promise = refreshBotToken(db, CREDS);
      const assertion = expect(promise).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: BOT_REAUTH_REQUIRED_MESSAGE,
      });
      await vi.advanceTimersByTimeAsync(500); // one poll, not the ~10s budget
      await assertion;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cas).toBe(2);
      expect(sets.at(-1)).toEqual({ refreshLockedUntil: null }); // released its own lease
    } finally {
      vi.useRealTimers();
    }
  });

  it("a loser that re-contends after the holder failed reports a transient error", async () => {
    vi.useFakeTimers();
    try {
      const released = makeAccount({ refreshLockedUntil: null });
      const findFirst = vi.fn().mockResolvedValueOnce(makeAccount()).mockResolvedValue(released);
      const db = {
        query: { botAccount: { findFirst } },
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      } as unknown as DbClient;

      const promise = refreshBotToken(db, CREDS);
      const assertion = expect(promise).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases the lease only if it still holds its own lease value", async () => {
    const { db, set, where } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });

    await refreshBotToken(db, CREDS).catch(() => undefined);

    const [acquireSet] = set.mock.calls[0] ?? [];
    const acquired = acquireSet?.refreshLockedUntil;
    if (!(acquired instanceof Date)) throw new Error("lease was not acquired with a Date");
    const release = renderWhere(where.mock.calls.at(-1)?.[0]);
    expect(release.sql).toContain('"refresh_locked_until" = ?');
    expect(release.params).toContain(acquired.getTime());
  });

  it("a loser gives up after the wait budget without calling Twitch", async () => {
    vi.useFakeTimers();
    try {
      // The holder crashed: the lease stays held and nothing is ever published.
      const stuck = makeAccount({ refreshLockedUntil: new Date(Date.now() + 15_000) });
      const findFirst = vi.fn(async () => stuck);
      const db = {
        query: { botAccount: { findFirst } },
        update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      } as unknown as DbClient;

      const promise = refreshBotToken(db, CREDS);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(stuck);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("validateChatToken", () => {
  it("returns false when Twitch reports the token revoked (401)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await validateChatToken("tok")).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://id.twitch.tv/oauth2/validate");
    expect(init.headers.Authorization).toBe("OAuth tok");
  });

  it("returns true when Twitch still honors the token", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await validateChatToken("tok")).toBe(true);
  });

  it("returns true on a transient network error (no needless refresh)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await validateChatToken("tok")).toBe(true);
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

  it("revalidate keeps a fresh, still-valid token without refreshing", async () => {
    const { db } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 }); // /validate

    expect(await getFreshChatToken(db, CREDS, { revalidate: true })).toBe("old-access");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only /validate, no refresh
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://id.twitch.tv/oauth2/validate");
  });

  it("revalidate refreshes a fresh-looking token that Twitch has revoked", async () => {
    const updatedRow = makeAccount({ accessToken: "new-access" });
    const { db } = makeDb({ botAccount: makeAccount(), updatedRow });
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 }) // /validate → revoked
      .mockResolvedValueOnce(okJson({ access_token: "new-access", expires_in: 3600 })); // refresh

    expect(await getFreshChatToken(db, CREDS, { revalidate: true })).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://id.twitch.tv/oauth2/validate");
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("https://id.twitch.tv/oauth2/token");
  });
});

describe("disconnectBotAccount", () => {
  it("revokes the access token then deletes the bot account", async () => {
    const { db, del, deleteWhere } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockResolvedValueOnce({ ok: true });

    expect(await disconnectBotAccount(db, CREDS)).toEqual({ revoked: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(url).toBe("https://id.twitch.tv/oauth2/revoke");
    expect(init.body.get("client_id")).toBe("client-id");
    expect(init.body.get("token")).toBe("old-access");
    expect(del).toHaveBeenCalledTimes(1);
    // The delete must stay scoped to the singleton row, not the whole table.
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("still deletes the account when revocation fails, and reports it", async () => {
    const { db, del, deleteWhere } = makeDb({ botAccount: makeAccount() });
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(await disconnectBotAccount(db, CREDS)).toEqual({ revoked: false });

    expect(del).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired token first and revokes the fresh one", async () => {
    const { db, deleteWhere } = makeDb({
      botAccount: makeAccount({ expiresAt: new Date(Date.now() - 60_000) }),
      updatedRow: makeAccount({ accessToken: "fresh-access" }),
    });
    fetchMock
      .mockResolvedValueOnce(okJson({ access_token: "fresh-access", expires_in: 3600 })) // refresh
      .mockResolvedValueOnce({ ok: true }); // revoke

    expect(await disconnectBotAccount(db, CREDS)).toEqual({ revoked: true });

    const [url, init] = fetchMock.mock.calls[1] as [string, { body: URLSearchParams }];
    expect(url).toBe("https://id.twitch.tv/oauth2/revoke");
    expect(init.body.get("token")).toBe("fresh-access");
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("retries with a refreshed token when Twitch rejects the stored one", async () => {
    const { db } = makeDb({
      botAccount: makeAccount(),
      updatedRow: makeAccount({ accessToken: "fresh-access" }),
    });
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400 }) // revoke stored token → dead
      .mockResolvedValueOnce(okJson({ access_token: "fresh-access", expires_in: 3600 }))
      .mockResolvedValueOnce({ ok: true }); // revoke fresh token

    expect(await disconnectBotAccount(db, CREDS)).toEqual({ revoked: true });
    const [, init] = fetchMock.mock.calls[2] as [string, { body: URLSearchParams }];
    expect(init.body.get("token")).toBe("fresh-access");
  });

  it("reports an unconfirmed revocation when the refresh also fails", async () => {
    const { db, deleteWhere } = makeDb({
      botAccount: makeAccount({ expiresAt: new Date(Date.now() - 60_000) }),
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 }); // refresh rejected

    expect(await disconnectBotAccount(db, CREDS)).toEqual({ revoked: false });
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("skips revocation when no account exists but still clears the row", async () => {
    const { db, del, deleteWhere } = makeDb({ botAccount: undefined });

    expect(await disconnectBotAccount(db, CREDS)).toEqual({ revoked: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});

describe("resolveChannelLogin", () => {
  const helix = { clientId: "client-id", accessToken: "chat-token" };

  it("re-resolves the login by twitchId so a Twitch rename is picked up", async () => {
    const { db, set } = makeDb({
      instanceConfig: { channelLogin: "oldwolf" },
      updatedRow: { channelLogin: "newwolf" },
    });
    fetchMock.mockResolvedValueOnce(okJson({ data: [{ login: "NewWolf" }] }));

    expect(await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "OldWolf" })).toBe(
      "newwolf",
    );
    expect(set).toHaveBeenCalledWith({ channelLogin: "newwolf" });
  });

  it("does not rewrite an unchanged cached login", async () => {
    const { db, set } = makeDb({ instanceConfig: { channelLogin: "mrdemonwolf" } });
    fetchMock.mockResolvedValueOnce(okJson({ data: [{ login: "mrdemonwolf" }] }));

    expect(
      await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "MrDemonWolf" }),
    ).toBe("mrdemonwolf");
    expect(set).not.toHaveBeenCalled();
  });

  it("falls back to the cached login when Helix fails", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: "mrdemonwolf" } });
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    expect(
      await resolveChannelLogin(db, helix, { twitchId: "42", fallbackName: "Display Name" }),
    ).toBe("mrdemonwolf");
  });

  it("uses the cached login without Helix when there is no twitchId", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: "mrdemonwolf" } });

    expect(await resolveChannelLogin(db, helix, { twitchId: null, fallbackName: "Dev" })).toBe(
      "mrdemonwolf",
    );
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

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://api.twitch.tv/helix/users?id=42");
    expect(init.headers.Authorization).toBe("Bearer chat-token");
    expect(init.headers["Client-Id"]).toBe("client-id");
    expect(set).toHaveBeenCalledWith({ channelLogin: "mrdemonwolf" });
  });

  it("falls back to the lowercased display name when there is no twitchId", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: null } });

    expect(await resolveChannelLogin(db, helix, { twitchId: null, fallbackName: "DevUser" })).toBe(
      "devuser",
    );
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

describe("strict Twitch protocol response validation", () => {
  it("rejects a refreshed access token containing IRC control characters", async () => {
    const { db, set } = makeDb({ botAccount: makeAccount(), updatedRow: makeAccount() });
    fetchMock.mockResolvedValueOnce(
      okJson({
        access_token: "token\r\nJOIN #attacker",
        refresh_token: "new-refresh",
        expires_in: 3600,
        token_type: "bearer",
      }),
    );

    await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(set).not.toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "token\r\nJOIN #attacker" }),
    );
  });

  it("rejects malformed refresh metadata instead of persisting it", async () => {
    const { db } = makeDb({ botAccount: makeAccount(), updatedRow: makeAccount() });
    fetchMock.mockResolvedValueOnce(
      okJson({ access_token: "new-access", expires_in: -1, token_type: "not-bearer" }),
    );

    await expect(refreshBotToken(db, CREDS)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("does not persist a malformed Helix login and uses a safe fallback", async () => {
    const { db, set } = makeDb({ instanceConfig: { channelLogin: null } });
    fetchMock.mockResolvedValueOnce(okJson({ data: [{ login: "owner\r\nJOIN attacker" }] }));

    await expect(
      resolveChannelLogin(
        db,
        { clientId: "id", accessToken: "token" },
        {
          twitchId: "42",
          fallbackName: "MrDemonWolf",
        },
      ),
    ).resolves.toBe("mrdemonwolf");
    expect(set).not.toHaveBeenCalledWith(
      expect.objectContaining({ channelLogin: expect.stringContaining("\r") }),
    );
  });

  it("fails safely when neither Twitch nor the fallback supplies a valid login", async () => {
    const { db } = makeDb({ instanceConfig: { channelLogin: "bad cached login" } });

    await expect(
      resolveChannelLogin(
        db,
        { clientId: "id", accessToken: "token" },
        {
          twitchId: null,
          fallbackName: "bad fallback name",
        },
      ),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
