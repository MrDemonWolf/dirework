import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import {
  activateTask,
  createTask,
  markTaskDone,
  promoteNextPending,
  replaceActiveTask,
  resolveTaskPlacement,
} from "../task-service";

interface StubOptions {
  ownerTwitchId?: string | null;
  ownerId?: string;
  ownerAccountId?: string;
  /** Returned by task.findFirst (used for last-order lookup / next-pending). */
  taskFindFirst?: Record<string, unknown>;
  /** Returned by task.findMany (open tasks). */
  openTasks?: Record<string, unknown>[];
  /** Override what a guarded UPDATE ... returning() yields (e.g. [] = CAS lost). */
  updateReturns?: Record<string, unknown>[];
  /** Make the first insert fail with a UNIQUE violation (concurrent create). */
  failFirstInsertUnique?: boolean;
}

function makeDb(opts: StubOptions) {
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();
  const userFindFirstSpy = vi.fn(async () =>
    opts.ownerTwitchId === undefined
      ? undefined
      : { id: opts.ownerId ?? "owner-user", twitchId: opts.ownerTwitchId },
  );
  let insertCalls = 0;
  const db = {
    query: {
      user: { findFirst: userFindFirstSpy },
      account: {
        findFirst: async () =>
          opts.ownerAccountId ? { accountId: opts.ownerAccountId } : undefined,
      },
      task: {
        findFirst: async () => opts.taskFindFirst,
        findMany: async () => opts.openTasks ?? [],
      },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertSpy(values);
        insertCalls += 1;
        const shouldFail = opts.failFirstInsertUnique && insertCalls === 1;
        return {
          returning: async () => {
            if (shouldFail) {
              throw new Error("D1_ERROR: UNIQUE constraint failed: task.author_twitch_id");
            }
            return [{ id: "new-task", ...values }];
          },
        };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updateSpy(values);
        return {
          where: () => ({
            returning: async () => opts.updateReturns ?? [{ ...opts.taskFindFirst, ...values }],
          }),
        };
      },
    }),
  } as unknown as DbClient;
  return { db, insertSpy, updateSpy, userFindFirstSpy };
}

describe("resolveTaskPlacement (audit M6)", () => {
  it("broadcaster gets priority 0", async () => {
    const { db, userFindFirstSpy } = makeDb({
      ownerTwitchId: "123",
      taskFindFirst: { order: 5 },
    });
    const placement = await resolveTaskPlacement(db, "123");
    expect(placement).toEqual({ isBroadcaster: true, priority: 0, nextOrder: 6 });
    expect(userFindFirstSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() }),
    );
  });

  it("viewer gets priority 1", async () => {
    const { db } = makeDb({ ownerTwitchId: "123", taskFindFirst: { order: 2 } });
    const placement = await resolveTaskPlacement(db, "456");
    expect(placement).toEqual({ isBroadcaster: false, priority: 1, nextOrder: 3 });
  });

  it("first task in a priority lane starts at order 1", async () => {
    const { db } = makeDb({ ownerTwitchId: "123", taskFindFirst: undefined });
    const placement = await resolveTaskPlacement(db, "456");
    expect(placement.nextOrder).toBe(1);
  });

  it("uses the linked Twitch account ID when the custom owner field is missing", async () => {
    const { db } = makeDb({
      ownerId: "internal-owner",
      ownerTwitchId: null,
      ownerAccountId: "123",
    });
    const placement = await resolveTaskPlacement(db, "123");
    expect(placement).toMatchObject({ isBroadcaster: true, priority: 0 });
  });

  it("uses the internal ID only for an owner without a linked Twitch account", async () => {
    const { db } = makeDb({
      ownerId: "internal-owner",
      ownerTwitchId: null,
    });
    const placement = await resolveTaskPlacement(db, "internal-owner");
    expect(placement).toMatchObject({ isBroadcaster: true, priority: 0 });
  });

  it("does not treat an unrelated ID as broadcaster without a linked Twitch account", async () => {
    const { db } = makeDb({ ownerTwitchId: null });
    const placement = await resolveTaskPlacement(db, "456");
    expect(placement.isBroadcaster).toBe(false);
    expect(placement.priority).toBe(1);
  });
});

describe("promoteNextPending (audit M5 / P1.7 single statement)", () => {
  it("promotes the first pending task to active", async () => {
    const { db, updateSpy } = makeDb({
      taskFindFirst: { id: "t1", status: "pending", authorTwitchId: "456" },
    });
    const promoted = await promoteNextPending(db, "456");
    expect(promoted).toMatchObject({ id: "t1", status: "active" });
    expect(updateSpy).toHaveBeenCalledWith({ status: "active" });
  });

  it("returns null when the guarded UPDATE matches no row", async () => {
    // P1.7: promotion is now ONE guarded UPDATE (target chosen by subquery,
    // plus a not-exists guard on an already-active task) instead of a
    // find-then-update pair, so "nothing to promote" surfaces as an empty
    // returning() rather than a skipped write. That's what removes the race
    // where two concurrent promotions could both find the same pending task.
    const { db } = makeDb({ updateReturns: [] });
    expect(await promoteNextPending(db, "456")).toBeNull();
  });
});

describe("createTask", () => {
  const author = {
    twitchId: "456",
    username: "viewer",
    displayName: "Viewer",
    color: "#ff0000",
  };

  it("auto-activates when the author has no open tasks", async () => {
    const { db, insertSpy } = makeDb({ ownerTwitchId: "123", openTasks: [] });
    const task = await createTask(db, author, "write docs");
    expect(task).toMatchObject({ text: "write docs", status: "active", priority: 1 });
    expect(insertSpy.mock.calls[0]?.[0]).toMatchObject({ status: "active" });
  });

  it("creates pending when the author already has open tasks", async () => {
    const { db, insertSpy } = makeDb({
      ownerTwitchId: "123",
      openTasks: [{ id: "existing" }],
      taskFindFirst: { order: 1 },
    });
    await createTask(db, author, "second task");
    expect(insertSpy.mock.calls[0]?.[0]).toMatchObject({ status: "pending", order: 2 });
  });

  it("activate option forces active even with open tasks (!next)", async () => {
    const { db, insertSpy } = makeDb({
      ownerTwitchId: "123",
      openTasks: [{ id: "existing" }],
      taskFindFirst: { order: 1 },
    });
    await createTask(db, author, "next task", { activate: true });
    expect(insertSpy.mock.calls[0]?.[0]).toMatchObject({ status: "active" });
  });

  // ── P1.7 concurrency ──────────────────────────────────────────────────────
  it("falls back to pending when a concurrent create wins the active slot", async () => {
    // Two !task commands from the same viewer both read "no open tasks" and
    // both try to insert an active row. The partial unique index rejects the
    // loser; it must still create the task, just queued as pending — never
    // drop the message and never end up with two active tasks.
    const { db, insertSpy } = makeDb({
      ownerTwitchId: "123",
      openTasks: [],
      failFirstInsertUnique: true,
    });

    const task = await createTask(db, author, "racing task");

    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(insertSpy.mock.calls[0]?.[0]).toMatchObject({ status: "active" });
    expect(insertSpy.mock.calls[1]?.[0]).toMatchObject({ status: "pending" });
    expect(task).toMatchObject({ text: "racing task", status: "pending" });
  });

  it("rethrows a non-unique insert failure instead of silently retrying", async () => {
    const db = {
      query: {
        user: { findFirst: async () => ({ twitchId: "123" }) },
        task: { findFirst: async () => undefined, findMany: async () => [] },
      },
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw new Error("D1_ERROR: database is locked");
          },
        }),
      }),
    } as unknown as DbClient;

    await expect(createTask(db, author, "boom")).rejects.toThrow(/database is locked/);
  });
});

// ── P1.7: activate / markDone are single atomic batches ─────────────────────
/**
 * db.batch stub: records the statements handed to it and returns each one's
 * pre-staged result. The point of these tests is that the multi-step task
 * mutations go through ONE batch (atomic on D1) rather than sequential awaits
 * that another chat command could interleave with.
 */
function makeBatchDb(opts: { taskFindFirst?: Record<string, unknown>; batchResults: unknown[] }) {
  const batchSpy = vi.fn();
  const setSpy = vi.fn();
  const stmt = () => ({
    set: (values: Record<string, unknown>) => {
      setSpy(values);
      // returning() has to serve BOTH uses: a statement handed to db.batch, and
      // a directly-awaited chain (the non-active markTaskDone path). An array
      // works for both — batch just collects it, await destructures it.
      return { where: () => ({ returning: () => [{ __stmt: values, ...values }] }) };
    },
  });
  const db = {
    query: { task: { findFirst: async () => opts.taskFindFirst } },
    update: stmt,
    batch: async (statements: unknown[]) => {
      batchSpy(statements);
      return opts.batchResults;
    },
  } as unknown as DbClient;
  return { db, batchSpy, setSpy };
}

describe("activateTask atomicity (P1.7)", () => {
  it("demotes and activates in ONE batch, demote first", async () => {
    const { db, batchSpy, setSpy } = makeBatchDb({
      batchResults: [[], [{ id: "t2", status: "active" }]],
    });

    const result = await activateTask(db, { id: "t2", authorTwitchId: "456" });

    expect(batchSpy).toHaveBeenCalledOnce();
    expect(batchSpy.mock.calls[0]?.[0]).toHaveLength(2);
    // Demote must precede activate so the single-active slot is free when the
    // unique index checks the activate.
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({ status: "pending" });
    expect(setSpy.mock.calls[1]?.[0]).toMatchObject({ status: "active" });
    expect(result).toMatchObject({ id: "t2", status: "active" });
  });
});

describe("markTaskDone atomicity (P1.7)", () => {
  it("completes and promotes in ONE batch when the task was active", async () => {
    const { db, batchSpy, setSpy } = makeBatchDb({
      taskFindFirst: { id: "t1", status: "active", authorTwitchId: "456" },
      batchResults: [[{ id: "t1", status: "done" }], [{ id: "t2", status: "active" }]],
    });

    const done = await markTaskDone(db, "t1");

    expect(batchSpy).toHaveBeenCalledOnce();
    expect(batchSpy.mock.calls[0]?.[0]).toHaveLength(2);
    expect(setSpy.mock.calls[0]?.[0]).toMatchObject({ status: "done" });
    expect(setSpy.mock.calls[1]?.[0]).toMatchObject({ status: "active" });
    expect(done).toMatchObject({ id: "t1", status: "done" });
  });

  it("does not batch a promote when the task was merely pending", async () => {
    // Completing a pending task frees no active slot, so promoting would
    // wrongly activate a second task.
    const { db, batchSpy } = makeBatchDb({
      taskFindFirst: { id: "t3", status: "pending", authorTwitchId: "456" },
      batchResults: [],
    });

    await markTaskDone(db, "t3");

    expect(batchSpy).not.toHaveBeenCalled();
  });

  it("returns null for a task that does not exist", async () => {
    const { db, batchSpy } = makeBatchDb({ taskFindFirst: undefined, batchResults: [] });
    expect(await markTaskDone(db, "nope")).toBeNull();
    expect(batchSpy).not.toHaveBeenCalled();
  });
});

describe("replaceActiveTask atomicity", () => {
  it("completes the old task and inserts the active replacement in one batch", async () => {
    const setSpy = vi.fn();
    const valuesSpy = vi.fn();
    const batchSpy = vi.fn(async (_statements: unknown[]) => [
      [{ id: "old", status: "done" }],
      [{ id: "new", status: "active", text: "next task" }],
    ]);
    const db = {
      query: {
        user: { findFirst: async () => ({ twitchId: "owner" }) },
        task: { findFirst: async () => ({ order: 4 }) },
      },
      update: () => ({
        set: (values: Record<string, unknown>) => {
          setSpy(values);
          return { where: () => ({ returning: () => ({ kind: "complete" }) }) };
        },
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          valuesSpy(values);
          return { returning: () => ({ kind: "insert" }) };
        },
      }),
      batch: batchSpy,
    } as unknown as DbClient;

    const result = await replaceActiveTask(
      db,
      { id: "old" },
      {
        twitchId: "viewer",
        username: "viewer",
        displayName: "Viewer",
        color: "#ff0000",
      },
      "next task",
    );

    expect(batchSpy).toHaveBeenCalledOnce();
    expect(batchSpy.mock.calls[0]?.[0]).toHaveLength(2);
    expect(setSpy).toHaveBeenCalledWith({ status: "done", completedAt: expect.any(Date) });
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: "next task", status: "active", priority: 1, order: 5 }),
    );
    expect(result.created).toMatchObject({ id: "new", status: "active" });
  });
});
