import { DrizzleQueryError } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { CHAT_DEDUPE_WINDOW_MS, claimChatMessage } from "../chat-dedupe";
import {
  DONE_TASK_LIST_LIMIT,
  DONE_TASK_RETENTION_MS,
  clearDoneTasks,
  createTask,
  isUniqueViolation,
  listOverlayTasks,
  listTasks,
  markTaskDone,
  promoteNextPending,
  purgeExpiredDoneTasks,
  removeTasksByUsername,
  replaceActiveTask,
} from "../task-service";
import { resetTimer, startTimer } from "../timer-service";

/**
 * The same services as task-service.test.ts, but against a real SQLite engine
 * with the D1 migrations applied — so the WHERE clauses, subqueries, and the
 * partial unique index are actually evaluated rather than ignored by a stub.
 */

let db: DbClient;
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

beforeEach(async () => {
  ({ db, sqlite } = await createSqliteDb());
});

type TaskSeed = Partial<typeof schema.task.$inferInsert> & { id: string; authorTwitchId: string };

async function seed(...rows: TaskSeed[]) {
  await db.insert(schema.task).values(
    rows.map((row, i) => ({
      authorUsername: `user${row.authorTwitchId}`,
      authorDisplayName: `User${row.authorTwitchId}`,
      text: `task ${row.id}`,
      status: "pending",
      order: i + 1,
      ...row,
    })),
  );
}

async function statusById() {
  const rows = await db.query.task.findMany({ columns: { id: true, status: true } });
  return Object.fromEntries(rows.map((row) => [row.id, row.status]));
}

const viewer = { twitchId: "100", username: "viewer", displayName: "Viewer" };

describe("removeTasksByUsername (ban / timeout / !clear @user)", () => {
  it("deletes only that author's tasks, case-insensitively", async () => {
    await seed(
      { id: "a", authorTwitchId: "1", authorUsername: "viewer" },
      { id: "b", authorTwitchId: "1", authorUsername: "viewer", status: "active" },
      { id: "c", authorTwitchId: "2", authorUsername: "someone" },
    );

    await removeTasksByUsername(db, "ViEwEr");

    expect(await statusById()).toEqual({ c: "pending" });
  });

  it("uses the lower(author_username) expression index instead of a full scan", async () => {
    const prepared: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    sqlite.prepare = (source, params) => {
      prepared.push(source);
      return prepare(source, params);
    };

    await removeTasksByUsername(db, "Viewer");

    const [deleteSql] = prepared;
    expect(deleteSql).toBeDefined();
    const plan = sqlite.exec(`EXPLAIN QUERY PLAN ${deleteSql}`, ["Viewer"]);
    expect(JSON.stringify(plan)).toContain("task_author_username_lower_idx");
  });
});

describe("promoteNextPending", () => {
  it("promotes the lowest (order, id) pending task, never a done one", async () => {
    await seed(
      { id: "done-first", authorTwitchId: "1", status: "done", order: 0 },
      { id: "b", authorTwitchId: "1", order: 2 },
      { id: "a", authorTwitchId: "1", order: 2 },
      { id: "other", authorTwitchId: "2", order: 1 },
    );

    const promoted = await promoteNextPending(db, "1");

    expect(promoted?.id).toBe("a");
    expect(await statusById()).toEqual({
      "done-first": "done",
      a: "active",
      b: "pending",
      other: "pending",
    });
  });

  it("is a no-op while the author already holds an active task", async () => {
    await seed(
      { id: "active", authorTwitchId: "1", status: "active" },
      { id: "queued", authorTwitchId: "1" },
    );

    expect(await promoteNextPending(db, "1")).toBeNull();
    expect(await statusById()).toEqual({ active: "active", queued: "pending" });
  });
});

describe("createTask concurrency fallback", () => {
  it("falls back to pending when the partial unique index rejects a second active task", async () => {
    // The author already holds an active task, but this create races as if it
    // had observed none — the real D1 error shape must route to the fallback.
    await seed({ id: "active", authorTwitchId: viewer.twitchId, status: "active" });

    const created = await createTask(db, viewer, "racing", { activate: true });

    expect(created).toMatchObject({ text: "racing", status: "pending" });
    const rows = await db.query.task.findMany({ columns: { status: true } });
    expect(rows.filter((row) => row.status === "active")).toHaveLength(1);
  });
});

describe("isUniqueViolation", () => {
  it("ignores the wrapper message, which embeds viewer-controlled params", () => {
    const err = new DrizzleQueryError(
      "insert into task",
      ["UNIQUE constraint failed"],
      new Error("D1_ERROR: database is locked"),
    );
    expect(isUniqueViolation(err)).toBe(false);
  });

  it("terminates on a cyclic cause chain", () => {
    const err = new Error("boom") as Error & { cause?: unknown };
    err.cause = err;
    expect(isUniqueViolation(err)).toBe(false);
  });
});

describe("replaceActiveTask", () => {
  it("creates nothing when the active task went stale before the batch", async () => {
    await seed({ id: "old", authorTwitchId: viewer.twitchId, status: "done" });

    const result = await replaceActiveTask(db, { id: "old" }, viewer, "new work");

    expect(result).toEqual({ completed: null, created: null });
    expect(await statusById()).toEqual({ old: "done" });
  });

  it("completes the active task and activates the replacement", async () => {
    await seed({ id: "old", authorTwitchId: viewer.twitchId, status: "active" });

    const result = await replaceActiveTask(db, { id: "old" }, viewer, "new work");

    expect(result.completed?.status).toBe("done");
    expect(result.created).toMatchObject({ text: "new work", status: "active" });
  });
});

describe("clearDoneTasks", () => {
  it("leaves pending and active rows", async () => {
    await seed(
      { id: "p", authorTwitchId: "1" },
      { id: "a", authorTwitchId: "2", status: "active" },
      { id: "d", authorTwitchId: "3", status: "done" },
    );

    await clearDoneTasks(db);

    expect(await statusById()).toEqual({ p: "pending", a: "active" });
  });
});

describe("claimChatMessage", () => {
  it("lets only the first relay of a message id through", async () => {
    expect(await claimChatMessage(db, "msg-1", 1_000_000)).toBe(true);
    expect(await claimChatMessage(db, "msg-1", 1_000_001)).toBe(false);
    expect(await claimChatMessage(db, "msg-2", 1_000_002)).toBe(true);
  });

  it("prunes ids older than the dedupe window", async () => {
    const start = 1_000_000;
    await claimChatMessage(db, "old", start);
    await claimChatMessage(db, "fresh", start + CHAT_DEDUPE_WINDOW_MS + 1);

    const rows = await db.query.processedChatMessage.findMany({ columns: { id: true } });
    expect(rows.map((row) => row.id)).toEqual(["fresh"]);
  });
});

describe("done-task retention (24h purge)", () => {
  const now = Date.now();
  const expired = new Date(now - DONE_TASK_RETENTION_MS - 60_000);
  const recent = new Date(now - 60_000);

  async function seedRetentionRows() {
    await seed(
      { id: "old-done", authorTwitchId: "1", status: "done", completedAt: expired },
      { id: "new-done", authorTwitchId: "1", status: "done", completedAt: recent },
      // Open tasks are never purged, however old.
      { id: "old-open", authorTwitchId: "2", createdAt: expired },
    );
  }

  it("deletes only done tasks completed before the window", async () => {
    await seedRetentionRows();

    expect(await purgeExpiredDoneTasks(db, now)).toBe(1);

    expect(await statusById()).toEqual({ "new-done": "done", "old-open": "pending" });
  });

  it("never throws — housekeeping must not fail the triggering action", async () => {
    const broken = {
      delete: () => {
        throw new Error("D1 down");
      },
    } as unknown as DbClient;
    await expect(purgeExpiredDoneTasks(broken)).resolves.toBe(0);
  });

  it.each([
    ["createTask", () => createTask(db, viewer, "fresh")],
    ["markTaskDone", () => markTaskDone(db, "old-open")],
    ["startTimer", () => startTimer(db)],
    ["resetTimer", () => resetTimer(db)],
  ])("%s runs the purge", async (_name, run) => {
    await seedRetentionRows();

    await run();

    const ids = Object.keys(await statusById());
    expect(ids).not.toContain("old-done");
    expect(ids).toContain("new-done");
  });

  it("replaceActiveTask runs the purge", async () => {
    await seedRetentionRows();
    await seed({ id: "act", authorTwitchId: viewer.twitchId, status: "active" });

    await replaceActiveTask(db, { id: "act" }, viewer, "next");

    expect(Object.keys(await statusById())).not.toContain("old-done");
  });
});

describe("listTasks (bounded read)", () => {
  it("returns every open task plus only the newest done tasks, in list order", async () => {
    const base = Date.now() - 10 * 60_000;
    const done = Array.from({ length: DONE_TASK_LIST_LIMIT + 5 }, (_, i) => ({
      id: `d${String(i).padStart(3, "0")}`,
      authorTwitchId: "9",
      status: "done",
      order: 100 + i,
      completedAt: new Date(base + i * 1000),
    }));
    await seed(
      ...done,
      { id: "viewer-open", authorTwitchId: "1", order: 1 },
      { id: "host-open", authorTwitchId: "2", priority: 0, order: 5, status: "active" },
    );

    const { tasks, counts } = await listTasks(db);

    // Counts cover ALL rows, not the bounded slice.
    expect(counts).toEqual({ open: 2, done: DONE_TASK_LIST_LIMIT + 5 });
    const doneIds = tasks.filter((t) => t.status === "done").map((t) => t.id);
    expect(doneIds).toHaveLength(DONE_TASK_LIST_LIMIT);
    // The 5 oldest completions are the ones dropped.
    expect(doneIds).not.toContain("d000");
    expect(doneIds).toContain(`d${String(DONE_TASK_LIST_LIMIT + 4).padStart(3, "0")}`);
    // Priority lane first, then order.
    expect(tasks.slice(0, 2).map((t) => t.id)).toEqual(["host-open", "viewer-open"]);
  });

  it("doneLimit 0 reads no done rows but still counts them", async () => {
    await seed(
      { id: "o", authorTwitchId: "1" },
      { id: "d", authorTwitchId: "1", status: "done", completedAt: new Date() },
    );

    const { tasks, counts } = await listOverlayTasks(db, { doneLimit: 0 });

    expect(tasks.map((t) => t.id)).toEqual(["o"]);
    expect(counts).toEqual({ open: 1, done: 1 });
  });

  it("never full-scans the task table (list, overlay list, count, purge)", async () => {
    const statements: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      statements.push(query);
      return prepare(query, params);
    });

    await listTasks(db);
    await listOverlayTasks(db);
    await purgeExpiredDoneTasks(db);
    spy.mockRestore();

    const taskStatements = statements.filter((q) => /from "task"/i.test(q));
    expect(taskStatements.length).toBeGreaterThanOrEqual(7);
    for (const query of taskStatements) {
      const [plan] = sqlite.exec(`EXPLAIN QUERY PLAN ${query}`);
      const details = (plan?.values ?? []).map((row) => String(row[3]));
      expect(
        details.some((d) => d.includes("task_status_completed_idx")),
        query,
      ).toBe(true);
      expect(
        details.filter((d) => /^SCAN "?task"?\b/.test(d)),
        query,
      ).toEqual([]);
    }
  });
});
