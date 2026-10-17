import { describe, expect, it, vi } from "vitest";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { ensureBotConfig } from "../provision";

describe("ensureBotConfig", () => {
  it("provisions on first use, then answers from one read with no write batch", async () => {
    const { db } = await createSqliteDb();

    const first = await ensureBotConfig(db);
    expect(first.id).toBeTruthy();

    // bot.ingest calls this per chat line: an existing row must not trigger
    // the five-insert provisioning batch again.
    const batch = vi.spyOn(db, "batch");
    const again = await ensureBotConfig(db);
    expect(again.id).toBe(first.id);
    expect(batch).not.toHaveBeenCalled();
  });
});
