import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import {
  checkFollower,
  FOLLOWER_CACHE_MS,
  NOT_FOLLOWER_CACHE_MS,
  pruneFollowerChecksStmt,
  readFollowerCheckStmt,
} from "../follower-check";

const NOW = 1_800_000_000_000;

let db: DbClient;
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

beforeEach(async () => {
  ({ db, sqlite } = await createSqliteDb());
});

function plan(query: { sql: string; params: unknown[] }): string[] {
  const [result] = sqlite.exec(
    `EXPLAIN QUERY PLAN ${query.sql}`,
    query.params as (string | number | null)[],
  );
  return (result?.values ?? []).map((row) => String(row[3]));
}

describe("follower_check queries never scan", () => {
  it("reads one viewer by primary key", () => {
    const details = plan(readFollowerCheckStmt(db, "2000").toSQL());
    expect(
      details.some((d) => /^SEARCH follower_check/.test(d)),
      details.join("\n"),
    ).toBe(true);
    expect(details.filter((d) => /^SCAN/.test(d))).toEqual([]);
  });

  it("prunes through the checked_at index", () => {
    const details = plan(pruneFollowerChecksStmt(db, NOW).toSQL());
    expect(
      details.some((d) => /follower_check_checked_at_idx/.test(d)),
      details.join("\n"),
    ).toBe(true);
    expect(details.filter((d) => /^SCAN/.test(d))).toEqual([]);
  });
});

describe("checkFollower", () => {
  it("trusts a follow for a week and a non-follow for minutes", async () => {
    const lookup = vi.fn(async () => "following" as const);
    expect(await checkFollower(db, "2000", lookup, NOW)).toBe("following");
    expect(await checkFollower(db, "2000", lookup, NOW + FOLLOWER_CACHE_MS - 1)).toBe("following");
    expect(lookup).toHaveBeenCalledTimes(1);
    await checkFollower(db, "2000", lookup, NOW + FOLLOWER_CACHE_MS);
    expect(lookup).toHaveBeenCalledTimes(2);

    const no = vi.fn(async () => "not-following" as const);
    expect(await checkFollower(db, "3000", no, NOW)).toBe("not-following");
    expect(await checkFollower(db, "3000", no, NOW + NOT_FOLLOWER_CACHE_MS - 1)).toBe(
      "not-following",
    );
    expect(no).toHaveBeenCalledTimes(1);
    await checkFollower(db, "3000", no, NOW + NOT_FOLLOWER_CACHE_MS);
    expect(no).toHaveBeenCalledTimes(2);
  });

  it("caches nothing when Twitch can't answer", async () => {
    const lookup = vi.fn(async () => "unavailable" as const);
    expect(await checkFollower(db, "2000", lookup, NOW)).toBe("unavailable");
    expect(await db.query.followerCheck.findMany()).toEqual([]);
  });

  it("an upsert replaces a viewer's stale answer", async () => {
    await checkFollower(db, "2000", async () => "not-following", NOW);
    await checkFollower(db, "2000", async () => "following", NOW + NOT_FOLLOWER_CACHE_MS);
    expect(await db.query.followerCheck.findMany()).toEqual([
      { twitchId: "2000", following: true, checkedAt: new Date(NOW + NOT_FOLLOWER_CACHE_MS) },
    ]);
  });

  it("still answers when the cache write fails", async () => {
    const broken = new Proxy(db, {
      get: (target, key, receiver) =>
        key === "batch"
          ? async () => Promise.reject(new Error("D1 down"))
          : Reflect.get(target, key, receiver),
    });
    expect(await checkFollower(broken, "2000", async () => "following", NOW)).toBe("following");
    expect(await db.select().from(schema.followerCheck)).toEqual([]);
  });
});
