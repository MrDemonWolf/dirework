import { beforeEach, describe, expect, it } from "vitest";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { MAX_BLOCKED_VIEWERS } from "../../chat-commands";
import { blockViewer, setBotMuted, unblockViewer } from "../bot-moderation";

/**
 * The block list and mute switch are guarded JSON1 UPDATEs, so their behaviour
 * lives in the WHERE clauses — run them on real SQLite, not a stub.
 */

let db: DbClient;

beforeEach(async () => {
  ({ db } = await createSqliteDb());
  await db.insert(schema.botConfig).values({ id: schema.SINGLETON_ID });
});

async function row() {
  const found = await db.query.botConfig.findFirst({
    columns: { muted: true, blockedViewers: true },
  });
  if (!found) throw new Error("bot_config row missing");
  return found;
}

async function seedTask(id: string, username: string) {
  await db.insert(schema.task).values({
    id,
    authorTwitchId: `id-${username}`,
    authorUsername: username,
    authorDisplayName: username,
    text: `task ${id}`,
    status: "pending",
    order: 1,
  });
}

describe("setBotMuted", () => {
  it("changes the row once and is a no-op when already in that state", async () => {
    expect(await setBotMuted(db, false)).toBe(false);
    expect(await setBotMuted(db, true)).toBe(true);
    expect((await row()).muted).toBe(true);
    expect(await setBotMuted(db, true)).toBe(false);
    expect(await setBotMuted(db, false)).toBe(true);
    expect((await row()).muted).toBe(false);
  });
});

describe("blockViewer / unblockViewer", () => {
  it("appends a login once and removes that viewer's tasks only", async () => {
    await seedTask("a", "Viewer");
    await seedTask("b", "other");

    expect(await blockViewer(db, "viewer")).toEqual({ added: true });
    expect(await blockViewer(db, "viewer")).toEqual({ added: false, reason: "already-blocked" });
    expect((await row()).blockedViewers).toEqual(["viewer"]);

    const left = await db.query.task.findMany({ columns: { id: true } });
    expect(left.map((task) => task.id)).toEqual(["b"]);
  });

  it("re-blocking sweeps tasks the viewer added since", async () => {
    await db.update(schema.botConfig).set({ blockedViewers: ["viewer"] });
    await seedTask("late", "viewer");

    expect(await blockViewer(db, "viewer")).toEqual({ added: false, reason: "already-blocked" });
    expect(await db.query.task.findMany()).toEqual([]);
  });

  it(`stops appending at ${MAX_BLOCKED_VIEWERS} names and keeps the viewer's tasks`, async () => {
    const full = Array.from({ length: MAX_BLOCKED_VIEWERS }, (_, i) => `viewer${i}`);
    await db.update(schema.botConfig).set({ blockedViewers: full });
    await seedTask("kept", "onemore");

    expect(await blockViewer(db, "onemore")).toEqual({ added: false, reason: "full" });
    expect((await row()).blockedViewers).toHaveLength(MAX_BLOCKED_VIEWERS);
    expect((await row()).blockedViewers).not.toContain("onemore");
    // Not blocked, so its tasks must not be removed.
    const left = await db.query.task.findMany({ columns: { id: true } });
    expect(left.map((task) => task.id)).toEqual(["kept"]);
  });

  it("unblock removes only the target and is a no-op for an unlisted login", async () => {
    await db.update(schema.botConfig).set({ blockedViewers: ["alpha", "beta", "gamma"] });

    expect(await unblockViewer(db, "beta")).toEqual({ removed: true });
    expect((await row()).blockedViewers).toEqual(["alpha", "gamma"]);
    expect(await unblockViewer(db, "beta")).toEqual({ removed: false });
    expect(await unblockViewer(db, "alpha")).toEqual({ removed: true });
    expect(await unblockViewer(db, "gamma")).toEqual({ removed: true });
    expect((await row()).blockedViewers).toEqual([]);
  });
});
