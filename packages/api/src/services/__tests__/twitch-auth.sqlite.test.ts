import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { disconnectBotAccount, refreshBotToken } from "../twitch-auth";

const CREDS = { clientId: "client-id", clientSecret: "client-secret" };

let db: DbClient;
const fetchMock = vi.fn();

beforeEach(async () => {
  ({ db } = await createSqliteDb());
  vi.stubGlobal("fetch", fetchMock);
  await db.insert(schema.botAccount).values({
    twitchId: "4000",
    username: "direbot",
    displayName: "DireBot",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: new Date(Date.now() + 60_000),
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const row = async () => (await db.query.botAccount.findFirst())!;

/** Another caller takes the lease (ours expired) while our Twitch call is in flight. */
const otherLease = new Date(Date.now() + 120_000);
const stealLease = (extra: Partial<typeof schema.botAccount.$inferInsert> = {}) =>
  db
    .update(schema.botAccount)
    .set({ refreshLockedUntil: otherLease, ...extra })
    .where(eq(schema.botAccount.id, "singleton"));

describe("refreshBotToken lease (real SQLite)", () => {
  it("persists rotated tokens but keeps a newer holder's lease", async () => {
    fetchMock.mockImplementationOnce(async () => {
      await stealLease();
      return new Response(
        JSON.stringify({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await refreshBotToken(db, CREDS);

    expect(result?.refreshToken).toBe("new-refresh");
    const current = await row();
    // Twitch already spent old-refresh, so the rotation must be saved...
    expect(current.refreshToken).toBe("new-refresh");
    // ...but the other caller's lease is not ours to clear.
    expect(current.refreshLockedUntil?.getTime()).toBe(otherLease.getTime());
  });

  it("clears its own lease after a normal refresh", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "new-access", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await refreshBotToken(db, CREDS);

    expect((await row()).refreshLockedUntil).toBeNull();
  });

  it("returns tokens another caller published instead of a false reauth", async () => {
    fetchMock.mockImplementationOnce(async () => {
      // The other caller rotated first, so Twitch rejects our spent token.
      await stealLease({ accessToken: "their-access", refreshToken: "their-refresh" });
      return new Response("{}", { status: 400 });
    });

    const result = await refreshBotToken(db, CREDS);

    expect(result?.accessToken).toBe("their-access");
  });

  it("still surfaces the failure when nobody else refreshed", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 400 }));

    await expect(refreshBotToken(db, CREDS)).rejects.toThrow();
    expect((await row()).refreshLockedUntil).toBeNull();
  });
});

describe("disconnectBotAccount (real SQLite)", () => {
  it("clears the confirmed bot-page step with the account, in the same batch", async () => {
    await db.insert(schema.instanceConfig).values({
      setupBotSourceConfirmed: true,
      setupTimerOverlayConfirmed: true,
    });
    // Twitch refuses everything: deletion and the flag reset must not depend on it.
    fetchMock.mockImplementation(async () => new Response(null, { status: 400 }));

    const result = await disconnectBotAccount(db, CREDS);

    expect(result.revoked).toBe(false);
    // The bot page can't run without the account; the other confirmations stand.
    expect(result.setup).toEqual({
      setupBotSourceConfirmed: false,
      setupTimerOverlayConfirmed: true,
      setupTasksOverlayConfirmed: false,
    });
    expect(await db.query.botAccount.findFirst()).toBeUndefined();
    const instance = await db.query.instanceConfig.findFirst();
    expect(instance?.setupBotSourceConfirmed).toBe(false);
    expect(instance?.setupTimerOverlayConfirmed).toBe(true);
  });
});
