import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import { persistTwitchIdFromAccount } from "../twitch-identity";

function makeDb() {
  const where = vi.fn(async (_condition: SQL) => undefined);
  const set = vi.fn((_values: Record<string, unknown>) => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { db: { update } as unknown as DbClient, update, set, where };
}

describe("persistTwitchIdFromAccount", () => {
  it("copies the Twitch account ID onto the user row, only when it is unset", async () => {
    const { db, set, where } = makeDb();

    await persistTwitchIdFromAccount(db, {
      providerId: "twitch",
      accountId: "12345",
      userId: "u1",
    });

    expect(set).toHaveBeenCalledWith({ twitchId: "12345" });
    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const query = new SQLiteSyncDialect().sqlToQuery(condition as SQL);
    // Scoped to the linking user, and never overwrites an existing ID.
    expect(query.sql).toContain('"user"."id" = ?');
    expect(query.sql).toContain('"user"."twitch_id" is null');
    expect(query.params).toEqual(["u1", ""]);
  });

  it("ignores non-Twitch providers and empty account IDs", async () => {
    const { db, update } = makeDb();

    await persistTwitchIdFromAccount(db, { providerId: "github", accountId: "9", userId: "u1" });
    await persistTwitchIdFromAccount(db, { providerId: "twitch", accountId: "", userId: "u1" });

    expect(update).not.toHaveBeenCalled();
  });
});
