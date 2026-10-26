import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { MAX_STARTED_PER_AUTHOR } from "../../config-defaults";
import {
  type TaskSnapshot,
  activateTask,
  getViewerOpenTasks,
  listOverlayTasks,
  listTasks,
  markTaskDone,
  pauseTask,
  promoteNextPending,
  removeTask,
  restoreTask,
  sortTasksForList,
  startTask,
} from "../task-service";

/**
 * Multiple active tasks: one focus (`active`) per author plus up to
 * MAX_STARTED_PER_AUTHOR parked `started` tasks. Real SQLite with every
 * migration applied, so the in-statement cap checks and the partial unique
 * index are actually evaluated.
 */

let db: DbClient;
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

beforeEach(async () => {
  ({ db, sqlite } = await createSqliteDb());
});

type TaskSeed = Partial<typeof schema.task.$inferInsert> & { id: string };

async function seed(...rows: TaskSeed[]) {
  await db.insert(schema.task).values(
    rows.map((row, i) => ({
      authorTwitchId: "1",
      authorUsername: `user${row.authorTwitchId ?? "1"}`,
      authorDisplayName: `User${row.authorTwitchId ?? "1"}`,
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

it("allows two parked tasks per author", () => {
  expect(MAX_STARTED_PER_AUTHOR).toBe(2);
});

describe("startTask", () => {
  it("makes the task the focus when the author has none", async () => {
    await seed({ id: "a" }, { id: "b" });

    const result = await startTask(db, "b");

    expect(result.outcome).toBe("focused");
    expect(result.task?.id).toBe("b");
    expect(await statusById()).toEqual({ a: "pending", b: "active" });
  });

  it("parks the task as started beside an existing focus, up to the cap", async () => {
    await seed({ id: "focus", status: "active" }, { id: "a" }, { id: "b" }, { id: "c" });

    expect((await startTask(db, "a")).outcome).toBe("started");
    expect((await startTask(db, "b")).outcome).toBe("started");
    expect(await startTask(db, "c")).toEqual({ outcome: "cap_reached", task: null });
    expect(await statusById()).toEqual({
      focus: "active",
      a: "started",
      b: "started",
      c: "pending",
    });
  });

  it("counts only the same author's started tasks against the cap", async () => {
    await seed(
      { id: "other-focus", authorTwitchId: "2", status: "active" },
      { id: "other-1", authorTwitchId: "2", status: "started" },
      { id: "other-2", authorTwitchId: "2", status: "started" },
      { id: "focus", status: "active" },
      { id: "mine" },
    );

    expect((await startTask(db, "mine")).outcome).toBe("started");
  });

  it("refuses anything that is not pending", async () => {
    await seed(
      { id: "focus", status: "active" },
      { id: "parked", status: "started" },
      { id: "finished", status: "done", completedAt: new Date() },
    );

    for (const id of ["focus", "parked", "finished", "missing"]) {
      expect(await startTask(db, id), id).toEqual({ outcome: "not_startable", task: null });
    }
    expect(await statusById()).toEqual({ focus: "active", parked: "started", finished: "done" });
  });

  it("never exceeds the cap or makes a second focus under concurrent starts", async () => {
    await seed(...Array.from({ length: 6 }, (_, i) => ({ id: `t${i}` })));

    // Every call reads "pending" before any batch runs; the guards decide.
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => startTask(db, `t${i}`)));

    const outcomes = results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual([
      "cap_reached",
      "cap_reached",
      "cap_reached",
      "focused",
      "started",
      "started",
    ]);
    const statuses = Object.values(await statusById());
    expect(statuses.filter((s) => s === "active")).toHaveLength(1);
    expect(statuses.filter((s) => s === "started")).toHaveLength(MAX_STARTED_PER_AUTHOR);
  });
});

describe("pauseTask", () => {
  it("returns a started task to pending and leaves the focus alone", async () => {
    await seed({ id: "focus", status: "active" }, { id: "parked", status: "started" });

    expect((await pauseTask(db, "parked"))?.status).toBe("pending");
    expect(await statusById()).toEqual({ focus: "active", parked: "pending" });
  });

  it("pauses the focus and promotes the oldest started task, not a pending one", async () => {
    await seed(
      { id: "early-pending", order: 1 },
      { id: "focus", status: "active", order: 2 },
      { id: "late-started", status: "started", order: 9 },
      { id: "early-started", status: "started", order: 5 },
    );

    expect((await pauseTask(db, "focus"))?.status).toBe("pending");
    expect(await statusById()).toEqual({
      "early-pending": "pending",
      focus: "pending",
      "late-started": "started",
      "early-started": "active",
    });
  });

  it("never re-promotes the task it just paused", async () => {
    // The paused focus sorts first among pending rows, so a promote that
    // didn't skip it would hand the focus straight back.
    await seed({ id: "focus", status: "active", order: 1 }, { id: "next", order: 2 });

    await pauseTask(db, "focus");

    expect(await statusById()).toEqual({ focus: "pending", next: "active" });
  });

  it("leaves no focus when nothing else is queued", async () => {
    await seed({ id: "only", status: "active" });

    await pauseTask(db, "only");

    expect(await statusById()).toEqual({ only: "pending" });
  });

  it("is a no-op (null) for pending, done and missing tasks", async () => {
    await seed({ id: "p" }, { id: "d", status: "done", completedAt: new Date() });

    expect(await pauseTask(db, "p")).toBeNull();
    expect(await pauseTask(db, "d")).toBeNull();
    expect(await pauseTask(db, "missing")).toBeNull();
    expect(await statusById()).toEqual({ p: "pending", d: "done" });
  });
});

describe("promotion order (oldest started first, then pending)", () => {
  it("promoteNextPending prefers a started task over an earlier pending one", async () => {
    await seed(
      { id: "pending-first", order: 1 },
      { id: "started-later", status: "started", order: 7 },
    );

    expect((await promoteNextPending(db, "1"))?.id).toBe("started-later");
  });

  it("falls back to the first pending task when none is started", async () => {
    await seed({ id: "b", order: 2 }, { id: "a", order: 1 });

    expect((await promoteNextPending(db, "1"))?.id).toBe("a");
  });

  it("completing the focus promotes the oldest started task", async () => {
    await seed(
      { id: "focus", status: "active", order: 1 },
      { id: "pending", order: 2 },
      { id: "s2", status: "started", order: 6 },
      { id: "s1", status: "started", order: 4 },
    );

    await markTaskDone(db, "focus");

    expect(await statusById()).toMatchObject({ focus: "done", s1: "active", s2: "started" });
  });

  it("removing the focus promotes the oldest started task", async () => {
    await seed(
      { id: "focus", status: "active", order: 1 },
      { id: "pending", order: 2 },
      { id: "s1", status: "started", order: 3 },
    );

    await removeTask(db, "focus");

    expect(await statusById()).toEqual({ pending: "pending", s1: "active" });
  });

  it("completing a started task leaves the focus and promotes nothing", async () => {
    await seed({ id: "focus", status: "active" }, { id: "parked", status: "started" }, { id: "p" });

    expect((await markTaskDone(db, "parked"))?.status).toBe("done");
    expect(await statusById()).toEqual({ focus: "active", parked: "done", p: "pending" });
  });
});

describe("activateTask (focus switch)", () => {
  it("parks the old focus as started when there is room", async () => {
    await seed({ id: "old", status: "active" }, { id: "new" });

    expect((await activateTask(db, { id: "new", authorTwitchId: "1" }))?.status).toBe("active");
    expect(await statusById()).toEqual({ old: "started", new: "active" });
  });

  it("demotes the old focus to pending when the started slots are full", async () => {
    await seed(
      { id: "old", status: "active" },
      { id: "s1", status: "started" },
      { id: "s2", status: "started" },
      { id: "new" },
    );

    await activateTask(db, { id: "new", authorTwitchId: "1" });

    expect(await statusById()).toEqual({
      old: "pending",
      s1: "started",
      s2: "started",
      new: "active",
    });
  });

  it("swaps with a started target: the slot it frees takes the old focus", async () => {
    await seed(
      { id: "old", status: "active" },
      { id: "s1", status: "started" },
      { id: "s2", status: "started" },
    );

    await activateTask(db, { id: "s1", authorTwitchId: "1" });

    expect(await statusById()).toEqual({ old: "started", s1: "active", s2: "started" });
  });

  it("re-focusing the current focus changes nothing", async () => {
    await seed({ id: "focus", status: "active" }, { id: "s1", status: "started" });

    expect((await activateTask(db, { id: "focus", authorTwitchId: "1" }))?.status).toBe("active");
    expect(await statusById()).toEqual({ focus: "active", s1: "started" });
  });
});

describe("restoreTask with a started snapshot", () => {
  const snapshot = (id: string): TaskSnapshot => ({
    id,
    authorTwitchId: "1",
    authorUsername: "user1",
    authorDisplayName: "User1",
    authorColor: null,
    text: `task ${id}`,
    status: "started",
    priority: 1,
    order: 1,
    createdAt: new Date(),
    completedAt: null,
  });

  it("comes back started while the cap has room", async () => {
    await seed({ id: "focus", status: "active" });

    expect((await restoreTask(db, snapshot("back")))?.status).toBe("started");
  });

  it("falls back to pending when the started slots are full", async () => {
    await seed(
      { id: "focus", status: "active" },
      { id: "s1", status: "started" },
      { id: "s2", status: "started" },
    );

    expect((await restoreTask(db, snapshot("back")))?.status).toBe("pending");
  });

  it("becomes the focus when the author has none", async () => {
    await seed({ id: "p" });

    expect((await restoreTask(db, snapshot("back")))?.status).toBe("active");
  });
});

describe("list reads include started tasks", () => {
  it("counts started as open and orders each author focus → started → pending", async () => {
    await seed(
      // Author 2's earliest task comes first, so their group stays first.
      { id: "2-pending", authorTwitchId: "2", order: 1 },
      { id: "1-pending", order: 2 },
      { id: "1-started", status: "started", order: 3 },
      { id: "2-active", authorTwitchId: "2", status: "active", order: 4 },
      { id: "1-active", status: "active", order: 5 },
      { id: "1-done", status: "done", order: 6, completedAt: new Date() },
    );

    const { tasks, counts } = await listTasks(db);

    expect(counts.open).toBe(5);
    expect(tasks.map((t) => t.id)).toEqual([
      "2-active",
      "1-active",
      "1-started",
      "2-pending",
      "1-pending",
      "1-done",
    ]);
    const overlay = await listOverlayTasks(db);
    expect(overlay.tasks.map((t) => t.id)).toEqual(tasks.map((t) => t.id));
  });

  it("getViewerOpenTasks includes started tasks (the chat cap counts them)", async () => {
    await seed({ id: "a", status: "active" }, { id: "s", status: "started" }, { id: "p" });

    expect((await getViewerOpenTasks(db, "1")).map((t) => t.id)).toEqual(["a", "s", "p"]);
  });

  it("sortTasksForList keeps each author's slots and the priority lane", () => {
    const row = (
      id: string,
      authorTwitchId: string,
      status: string,
      order: number,
      priority = 1,
    ) => ({
      id,
      authorTwitchId,
      status,
      order,
      priority,
    });

    const sorted = sortTasksForList([
      row("v-pending", "v", "pending", 1),
      row("host-pending", "h", "pending", 9, 0),
      row("v-started", "v", "started", 2),
      row("host-active", "h", "active", 10, 0),
    ]);

    expect(sorted.map((t) => t.id)).toEqual([
      "host-active",
      "host-pending",
      "v-started",
      "v-pending",
    ]);
  });
});

describe("query plans", () => {
  it("no new started/focus predicate full-scans the task table", async () => {
    await seed(
      { id: "focus", status: "active" },
      { id: "s1", status: "started" },
      { id: "p1" },
      { id: "p2" },
    );
    const statements: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      statements.push(query);
      return prepare(query, params);
    });

    await startTask(db, "p1");
    await activateTask(db, { id: "p2", authorTwitchId: "1" });
    await pauseTask(db, "p2");
    await pauseTask(db, "s1");
    await promoteNextPending(db, "1");
    await restoreTask(db, {
      id: "restored",
      authorTwitchId: "1",
      authorUsername: "user1",
      authorDisplayName: "User1",
      authorColor: null,
      text: "back",
      status: "started",
      priority: 1,
      order: 1,
      createdAt: new Date(),
      completedAt: null,
    });
    spy.mockRestore();

    const taskStatements = statements.filter((q) => /"task"/i.test(q));
    expect(taskStatements.length).toBeGreaterThanOrEqual(8);
    for (const query of taskStatements) {
      const [plan] = sqlite.exec(`EXPLAIN QUERY PLAN ${query}`);
      const details = (plan?.values ?? []).map((row) => String(row[3]));
      expect(
        details.filter((d) => /^SCAN "?task"?\b/.test(d)),
        query,
      ).toEqual([]);
    }
  });
});
