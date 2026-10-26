import { beforeEach, describe, expect, it } from "vitest";

import type { DbClient } from "@dirework/db";
import { provisionSingletonRows } from "@dirework/db/provision";

import { BOT_LEASE_TTL_MS, isBotLeaseLive, isLeaseHeldByOther } from "../../bot-lease";
import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { claimBotLease, claimBotLeaseStmt, releaseBotLease } from "../bot-lease";

/**
 * The one-bot-page lease is a guarded UPDATE: who wins lives in its WHERE clause, so it runs
 * on real SQLite, not a stub.
 */

const PAGE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAGE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const T0 = 1_800_000_000_000;

let db: DbClient;
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

beforeEach(async () => {
  ({ db, sqlite } = await createSqliteDb());
  await provisionSingletonRows(db);
});

async function lease() {
  const row = await db.query.instanceConfig.findFirst({
    columns: { botLeaseInstanceId: true, botLeaseSeenAt: true },
  });
  return { instanceId: row?.botLeaseInstanceId ?? null, seenAt: row?.botLeaseSeenAt ?? null };
}

describe("claimBotLease", () => {
  it("takes a free lease and stamps the check-in", async () => {
    expect(await lease()).toEqual({ instanceId: null, seenAt: null });

    expect(await claimBotLease(db, { instanceId: PAGE_A, now: T0 })).toBe(true);

    expect(await lease()).toEqual({ instanceId: PAGE_A, seenAt: new Date(T0) });
  });

  it("renews the holder's own lease", async () => {
    await claimBotLease(db, { instanceId: PAGE_A, now: T0 });

    expect(await claimBotLease(db, { instanceId: PAGE_A, now: T0 + 120_000 })).toBe(true);

    expect(await lease()).toEqual({ instanceId: PAGE_A, seenAt: new Date(T0 + 120_000) });
  });

  it("refuses a second page while the lease is live, and writes nothing", async () => {
    await claimBotLease(db, { instanceId: PAGE_A, now: T0 });

    expect(await claimBotLease(db, { instanceId: PAGE_B, now: T0 + BOT_LEASE_TTL_MS - 1 })).toBe(
      false,
    );

    expect(await lease()).toEqual({ instanceId: PAGE_A, seenAt: new Date(T0) });
  });

  it("hands an expired lease to the next page", async () => {
    await claimBotLease(db, { instanceId: PAGE_A, now: T0 });

    expect(await claimBotLease(db, { instanceId: PAGE_B, now: T0 + BOT_LEASE_TTL_MS })).toBe(true);

    expect(await lease()).toEqual({
      instanceId: PAGE_B,
      seenAt: new Date(T0 + BOT_LEASE_TTL_MS),
    });
    // The old holder's next heartbeat finds it lost.
    expect(await claimBotLease(db, { instanceId: PAGE_A, now: T0 + BOT_LEASE_TTL_MS + 1 })).toBe(
      false,
    );
  });

  it("takeover forces a live lease to the new page", async () => {
    await claimBotLease(db, { instanceId: PAGE_A, now: T0 });

    expect(await claimBotLease(db, { instanceId: PAGE_B, takeover: true, now: T0 + 1000 })).toBe(
      true,
    );

    expect((await lease()).instanceId).toBe(PAGE_B);
    expect(await claimBotLease(db, { instanceId: PAGE_A, now: T0 + 2000 })).toBe(false);
  });

  it("lets exactly one of two pages claiming at once win", async () => {
    const results = await Promise.all([
      claimBotLease(db, { instanceId: PAGE_A, now: T0 }),
      claimBotLease(db, { instanceId: PAGE_B, now: T0 }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = results[0] ? PAGE_A : PAGE_B;
    expect((await lease()).instanceId).toBe(winner);
  });

  it.each([false, true])(
    "finds the singleton by primary key, never by scanning (takeover %s)",
    (takeover) => {
      const query = claimBotLeaseStmt(db, { instanceId: PAGE_A, takeover, now: T0 }).toSQL();
      const [plan] = sqlite.exec(
        `EXPLAIN QUERY PLAN ${query.sql}`,
        query.params as (string | number | null)[],
      );
      const details = (plan?.values ?? []).map((row) => String(row[3]));
      expect(
        details.some((d) => /^SEARCH .*instance_config/.test(d)),
        details.join("\n"),
      ).toBe(true);
      expect(details.filter((d) => /^SCAN/.test(d))).toEqual([]);
    },
  );
});

describe("releaseBotLease", () => {
  it("frees the holder's lease", async () => {
    await claimBotLease(db, { instanceId: PAGE_A, now: T0 });

    expect(await releaseBotLease(db, PAGE_A)).toBe(true);

    expect(await lease()).toEqual({ instanceId: null, seenAt: null });
    expect(await claimBotLease(db, { instanceId: PAGE_B, now: T0 + 1 })).toBe(true);
  });

  it("leaves a lease another page took alone", async () => {
    await claimBotLease(db, { instanceId: PAGE_A, now: T0 });
    await claimBotLease(db, { instanceId: PAGE_B, takeover: true, now: T0 + 1 });

    expect(await releaseBotLease(db, PAGE_A)).toBe(false);

    expect(await lease()).toEqual({ instanceId: PAGE_B, seenAt: new Date(T0 + 1) });
  });
});

describe("lease predicates", () => {
  it("a lease is live for BOT_LEASE_TTL_MS after its check-in", () => {
    expect(isBotLeaseLive(null, T0)).toBe(false);
    expect(isBotLeaseLive(new Date(T0), T0 + BOT_LEASE_TTL_MS - 1)).toBe(true);
    expect(isBotLeaseLive(new Date(T0), T0 + BOT_LEASE_TTL_MS)).toBe(false);
  });

  it("only a live lease held by another page blocks", () => {
    const held = { instanceId: PAGE_A, seenAt: new Date(T0) };
    expect(isLeaseHeldByOther(held, PAGE_B, T0 + 1)).toBe(true);
    expect(isLeaseHeldByOther(held, PAGE_A, T0 + 1)).toBe(false);
    expect(isLeaseHeldByOther(held, PAGE_B, T0 + BOT_LEASE_TTL_MS)).toBe(false);
    expect(isLeaseHeldByOther({ instanceId: null, seenAt: null }, PAGE_B, T0)).toBe(false);
  });
});
