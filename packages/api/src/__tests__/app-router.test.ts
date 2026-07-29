import { describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { appRouter } from "../routers/index";

/**
 * Integration tests driving the REAL appRouter through createCaller.
 *
 * Everything here goes through the actual middleware chain, input schemas, and
 * service functions — previously the router suites only parsed input schemas in
 * isolation, so authorization, error mapping, and the DB effects of a procedure
 * were entirely untested.
 */

interface DbRows {
  tasks?: Record<string, unknown>[];
  timerState?: Record<string, unknown>;
  timerConfig?: Record<string, unknown>;
  instanceConfig?: Record<string, unknown>;
}

/**
 * A provisioned instance: ensureSingletons throws INTERNAL_SERVER_ERROR when a
 * config singleton is missing, so config-touching procedures need these present.
 * Values are minimal — the build helpers fill the rest from column defaults.
 */
const PROVISIONED = {
  timerConfig: { id: "singleton", workDuration: 1_500_000, defaultCycles: 4 },
  timerStyle: { id: "singleton" },
  taskStyle: { id: "singleton" },
  botConfig: { id: "singleton", commandAliases: {} },
};

/** Records every write so tests can assert real DB effects, not just returns. */
function makeDb(rows: DbRows = {}) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const deleted: { table: unknown }[] = [];

  const db = {
    query: {
      task: {
        findMany: async () => rows.tasks ?? [],
        findFirst: async () => rows.tasks?.[0],
      },
      timerState: { findFirst: async () => rows.timerState },
      timerConfig: { findFirst: async () => rows.timerConfig ?? PROVISIONED.timerConfig },
      timerStyle: { findFirst: async () => PROVISIONED.timerStyle },
      taskStyle: { findFirst: async () => PROVISIONED.taskStyle },
      botConfig: { findFirst: async () => PROVISIONED.botConfig },
      instanceConfig: { findFirst: async () => rows.instanceConfig },
      user: { findFirst: async () => ({ twitchId: "owner-1", name: "streamer" }) },
      botAccount: { findFirst: async () => undefined },
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted.push(values);
        return {
          returning: async () => [{ id: "new-id", ...values }],
          onConflictDoNothing: () => ({ returning: async () => [] }),
        };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updated.push(values);
        return { where: () => ({ returning: async () => [{ id: "row", ...values }] }) };
      },
    }),
    delete: (table: unknown) => {
      deleted.push({ table });
      return { where: () => ({ returning: async () => [] }) };
    },
    batch: async (stmts: unknown[]) => stmts.map(() => []),
  } as unknown as Context["db"];

  return { db, inserted, updated, deleted };
}

const ownerSession = { user: { id: "u1", isOwner: true, name: "streamer" } };
const nonOwnerSession = { user: { id: "u2", isOwner: false, name: "rando" } };

function caller(session: unknown, rows: DbRows = {}) {
  const { db, inserted, updated, deleted } = makeDb(rows);
  return {
    caller: appRouter.createCaller({ session, db } as unknown as Context),
    inserted,
    updated,
    deleted,
  };
}

describe("authentication (appRouter)", () => {
  it("rejects anonymous callers on protected reads", async () => {
    const { caller: anon } = caller(null);
    await expect(anon.task.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.timer.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anon.config.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects anonymous callers on mutations", async () => {
    const { caller: anon, inserted } = caller(null);
    await expect(anon.timer.start({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    // The mutation must not have touched the DB before the gate rejected it.
    expect(inserted).toHaveLength(0);
  });

  it("leaves genuinely public procedures reachable", async () => {
    const { caller: anon } = caller(null, { instanceConfig: { overlayTimerToken: "t".repeat(32) } });
    // A wrong overlay token resolves null (OBS renders blank) rather than throwing.
    await expect(anon.overlay.getTimerState({ token: "x".repeat(32) })).resolves.toBeNull();
  });
});

describe("authorization — non-owner cannot read secrets or mutate (P1.9)", () => {
  it("blocks a non-owner from reading the bot page token", async () => {
    const { caller: rando } = caller(nonOwnerSession);
    // getIngestInfo returns instanceConfig.botToken — the bot page secret.
    await expect(rando.bot.getIngestInfo()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks a non-owner from rotating tokens", async () => {
    const { caller: rando, updated } = caller(nonOwnerSession);
    await expect(rando.bot.regenerateBotToken()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      rando.user.regenerateOverlayToken({ type: "timer" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updated).toHaveLength(0);
  });

  it("blocks a non-owner from mutating tasks, the timer, and config", async () => {
    const { caller: rando, inserted, updated, deleted } = caller(nonOwnerSession);
    await expect(
      rando.task.create({
        authorTwitchId: "1",
        authorUsername: "a",
        authorDisplayName: "A",
        text: "hi",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(rando.timer.reset()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(rando.task.clearAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      rando.config.updateTimerConfig({ workDuration: 60_000 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Nothing reached the database.
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });
});

describe("input validation through the real procedures", () => {
  it("rejects empty task text", async () => {
    const { caller: owner } = caller(ownerSession);
    await expect(
      owner.task.create({
        authorTwitchId: "1",
        authorUsername: "a",
        authorDisplayName: "A",
        text: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an out-of-range cycle count", async () => {
    const { caller: owner } = caller(ownerSession);
    await expect(owner.timer.start({ totalCycles: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(owner.timer.start({ totalCycles: 100 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects a CSS-injecting style colour (P1.10 allowlist)", async () => {
    const { caller: owner, updated } = caller(ownerSession);
    await expect(
      owner.config.updateTimerStyles({
        timerStyles: { background: { color: "red; background: url(https://evil.test/x)" } },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updated).toHaveLength(0);
  });

  it("rejects an out-of-range opacity", async () => {
    const { caller: owner } = caller(ownerSession);
    await expect(
      owner.config.updateTimerStyles({ timerStyles: { background: { opacity: 5 } } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an under-length overlay token", async () => {
    const { caller: anon } = caller(null);
    await expect(anon.overlay.getTimerState({ token: "short" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("database effects of owner mutations", () => {
  it("task.create inserts the task with the author and text", async () => {
    const { caller: owner, inserted } = caller(ownerSession, { tasks: [] });

    await owner.task.create({
      authorTwitchId: "viewer-9",
      authorUsername: "viewer",
      authorDisplayName: "Viewer",
      text: "write the docs",
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      authorTwitchId: "viewer-9",
      text: "write the docs",
    });
  });

  it("timer.pause writes a paused state derived from the running timer", async () => {
    const { caller: owner, updated } = caller(ownerSession, {
      timerState: {
        id: "singleton",
        status: "work",
        targetEndTime: new Date(Date.now() + 60_000),
        currentCycle: 1,
        totalCycles: 4,
        pausedWithRemaining: null,
        pausedFromStatus: null,
      },
    });

    await owner.timer.pause();

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ status: "paused", pausedFromStatus: "work" });
  });

  it("config.updateTimerConfig persists a valid duration", async () => {
    const { caller: owner, updated } = caller(ownerSession);
    await owner.config.updateTimerConfig({ workDuration: 30 * 60 * 1000 });
    expect(updated.at(-1)).toMatchObject({ workDuration: 30 * 60 * 1000 });
  });
});

describe("error behaviour", () => {
  it("bot.getSession rejects an invalid bot token as UNAUTHORIZED", async () => {
    const { caller: anon } = caller(null, {
      instanceConfig: { botToken: "b".repeat(32) },
    });
    await expect(
      anon.bot.getSession({ token: "z".repeat(32) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("bot.ingest rejects clearchat without a target username", async () => {
    const token = "b".repeat(32);
    const { caller: anon } = caller(null, { instanceConfig: { botToken: token } });
    await expect(
      anon.bot.ingest({ token, kind: "clearchat" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not leak the stored token value in the rejection", async () => {
    const secret = "b".repeat(32);
    const { caller: anon } = caller(null, { instanceConfig: { botToken: secret } });
    const err = await anon.bot.getSession({ token: "z".repeat(32) }).catch((e: Error) => e);
    expect(JSON.stringify(err)).not.toContain(secret);
  });
});

describe("public overlay procedures honour the token gate", () => {
  it("returns the payload when the overlay token matches", async () => {
    const token = "t".repeat(32);
    const { caller: anon } = caller(null, {
      instanceConfig: { overlayTimerToken: token, overlayTasksToken: token },
      tasks: [{ id: "1", text: "task", status: "active" }],
    });

    const result = await anon.overlay.getTaskList({ token });

    expect(result).not.toBeNull();
    expect(result?.tasks).toHaveLength(1);
  });

  it("never reaches the loader for a mismatched token", async () => {
    const token = "t".repeat(32);
    const findMany = vi.fn(async () => []);
    const db = {
      query: {
        instanceConfig: {
          findFirst: async () => ({ overlayTimerToken: token, overlayTasksToken: token }),
        },
        task: { findMany },
        taskStyle: { findFirst: async () => undefined },
      },
    } as unknown as Context["db"];

    const anon = appRouter.createCaller({ session: null, db } as unknown as Context);
    await expect(anon.overlay.getTaskList({ token: "w".repeat(32) })).resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });
});
