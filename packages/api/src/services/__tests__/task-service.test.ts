import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import { createTask, promoteNextPending, resolveTaskPlacement } from "../task-service";

interface StubOptions {
  ownerTwitchId?: string | null;
  /** Returned by task.findFirst (used for last-order lookup / next-pending). */
  taskFindFirst?: Record<string, unknown>;
  /** Returned by task.findMany (open tasks). */
  openTasks?: Record<string, unknown>[];
}

function makeDb(opts: StubOptions) {
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();
  const db = {
    query: {
      user: {
        findFirst: async () =>
          opts.ownerTwitchId === undefined ? undefined : { twitchId: opts.ownerTwitchId },
      },
      task: {
        findFirst: async () => opts.taskFindFirst,
        findMany: async () => opts.openTasks ?? [],
      },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertSpy(values);
        return { returning: async () => [{ id: "new-task", ...values }] };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updateSpy(values);
        return {
          where: () => ({
            returning: async () => [{ ...opts.taskFindFirst, ...values }],
          }),
        };
      },
    }),
  } as unknown as DbClient;
  return { db, insertSpy, updateSpy };
}

describe("resolveTaskPlacement (audit M6)", () => {
  it("broadcaster gets priority 0", async () => {
    const { db } = makeDb({ ownerTwitchId: "123", taskFindFirst: { order: 5 } });
    const placement = await resolveTaskPlacement(db, "123");
    expect(placement).toEqual({ isBroadcaster: true, priority: 0, nextOrder: 6 });
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

  it("a null owner twitchId never matches (no accidental broadcaster)", async () => {
    const { db } = makeDb({ ownerTwitchId: null });
    const placement = await resolveTaskPlacement(db, "456");
    expect(placement.isBroadcaster).toBe(false);
    expect(placement.priority).toBe(1);
  });
});

describe("promoteNextPending (audit M5)", () => {
  it("promotes the first pending task to active", async () => {
    const { db, updateSpy } = makeDb({
      taskFindFirst: { id: "t1", status: "pending", authorTwitchId: "456" },
    });
    const promoted = await promoteNextPending(db, "456");
    expect(promoted).toMatchObject({ id: "t1", status: "active" });
    expect(updateSpy).toHaveBeenCalledWith({ status: "active" });
  });

  it("returns null (no write) when nothing is pending", async () => {
    const { db, updateSpy } = makeDb({ taskFindFirst: undefined });
    expect(await promoteNextPending(db, "456")).toBeNull();
    expect(updateSpy).not.toHaveBeenCalled();
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
});
