import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
} from "../config-shared";
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
  user?: Record<string, unknown>;
  twitchAccount?: Record<string, unknown>;
  botConfig?: Record<string, unknown>;
  /** What the guarded instance-config UPDATE returns (default: echoes the write). */
  updateReturns?: Record<string, unknown>[];
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
  // Batches of UPDATE statements (provisioning's insert batches are not recorded).
  const batches: unknown[][] = [];

  const db = {
    query: {
      task: {
        // The bounded done-task read is the only task findMany with a `limit`;
        // seeded rows are open tasks, so it sees none (real SQL is covered by
        // the sqlite suites).
        findMany: async (args?: { limit?: number }) =>
          args?.limit === undefined ? (rows.tasks ?? []) : [],
        findFirst: async () => rows.tasks?.[0],
      },
      timerState: { findFirst: async () => rows.timerState },
      timerConfig: { findFirst: async () => rows.timerConfig ?? PROVISIONED.timerConfig },
      timerStyle: { findFirst: async () => PROVISIONED.timerStyle },
      taskStyle: { findFirst: async () => PROVISIONED.taskStyle },
      botConfig: { findFirst: async () => rows.botConfig ?? PROVISIONED.botConfig },
      instanceConfig: { findFirst: async () => rows.instanceConfig },
      user: {
        findFirst: async () =>
          rows.user ?? {
            id: "u1",
            twitchId: "owner-1",
            name: "streamer",
            displayName: "Streamer",
          },
      },
      account: { findFirst: async () => rows.twitchAccount },
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
        return {
          where: () => ({
            kind: "update",
            returning: async () => rows.updateReturns ?? [{ id: "row", ...values }],
          }),
        };
      },
    }),
    select: () => ({ from: () => ({ where: async () => [{ id: "singleton" }] }) }),
    $count: async () => 0,
    delete: (table: unknown) => {
      deleted.push({ table });
      return { where: () => ({ returning: async () => [] }) };
    },
    batch: async (stmts: { kind?: string }[]) => {
      if (stmts.some((stmt) => stmt.kind === "update")) batches.push(stmts);
      return stmts.map(() => []);
    },
  } as unknown as Context["db"];

  return { db, inserted, updated, deleted, batches };
}

const ownerSession = {
  user: {
    id: "u1",
    isOwner: true,
    name: "streamer",
    twitchId: "owner-1",
    displayName: "Streamer",
  },
};
const nonOwnerSession = { user: { id: "u2", isOwner: false, name: "rando" } };

function caller(session: unknown, rows: DbRows = {}) {
  const { db, inserted, updated, deleted, batches } = makeDb(rows);
  return {
    caller: appRouter.createCaller({ session, db } as unknown as Context),
    inserted,
    updated,
    deleted,
    batches,
  };
}

/** Every procedure reachable without a session. Everything else must be owner-only. */
const PUBLIC_PROCEDURES = [
  "bot.getSession",
  "bot.ingest",
  "overlay.getTaskList",
  "overlay.getTimerState",
  "user.hasOwner",
];
const ALL_PROCEDURES = Object.keys(appRouter._def.procedures).sort();
const OWNER_PROCEDURES = ALL_PROCEDURES.filter((path) => !PUBLIC_PROCEDURES.includes(path));

/**
 * Call a procedure by dotted path with `{}` input. The auth middleware runs
 * before input parsing, so `{}` is enough to reach the gate. The context's db is
 * an empty object: any DB access throws a TypeError, which matches neither
 * UNAUTHORIZED nor FORBIDDEN, so a procedure that touches the DB before its
 * gate fails the matrix loudly.
 */
function callByPath(session: unknown, path: string) {
  const root = appRouter.createCaller({ session, db: {} } as unknown as Context);
  const fn = path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], root) as (
    input: unknown,
  ) => Promise<unknown>;
  return fn({});
}

describe("authorization matrix (every procedure)", () => {
  it("covers the router: the public allowlist names real procedures", () => {
    expect(OWNER_PROCEDURES.length).toBeGreaterThan(0);
    for (const path of PUBLIC_PROCEDURES) expect(ALL_PROCEDURES).toContain(path);
  });

  it.each(OWNER_PROCEDURES)("%s rejects anonymous callers", async (path) => {
    await expect(callByPath(null, path)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each(OWNER_PROCEDURES)("%s rejects a signed-in non-owner", async (path) => {
    await expect(callByPath(nonOwnerSession, path)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(PUBLIC_PROCEDURES)("%s is reachable without a session", async (path) => {
    const error = await callByPath(null, path).catch((e: { code?: string }) => e);
    expect((error as { code?: string } | undefined)?.code).not.toBe("UNAUTHORIZED");
    expect((error as { code?: string } | undefined)?.code).not.toBe("FORBIDDEN");
  });
});

describe("authentication (appRouter)", () => {
  it("leaves genuinely public procedures reachable", async () => {
    const { caller: anon } = caller(null, {
      instanceConfig: { overlayTimerToken: "t".repeat(32) },
    });
    // A wrong overlay token resolves null (OBS renders blank) rather than throwing.
    await expect(anon.overlay.getTimerState({ token: "x".repeat(32) })).resolves.toBeNull();
  });
});

describe("input validation through the real procedures", () => {
  it("rejects empty task text", async () => {
    const { caller: owner } = caller(ownerSession);
    await expect(owner.task.create({ text: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("rejects a CSS-injecting style colour (allowlist, not a length cap)", async () => {
    const { caller: owner, updated } = caller(ownerSession);
    await expect(
      owner.config.updateStyles({
        timerStyles: { background: { color: "red; background: url(https://evil.test/x)" } },
        taskStyles: {},
        phaseLabels: DEFAULT_PHASE_LABELS,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updated).toHaveLength(0);
  });

  it("rejects an out-of-range opacity", async () => {
    const { caller: owner } = caller(ownerSession);
    await expect(
      owner.config.updateStyles({
        timerStyles: { background: { opacity: 5 } },
        taskStyles: {},
        phaseLabels: DEFAULT_PHASE_LABELS,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an alias that would replace a built-in command", async () => {
    const { caller: owner, updated } = caller(ownerSession);
    await expect(
      owner.config.updateBotSettings({
        taskCommandsEnabled: true,
        timerCommandsEnabled: true,
        task: DEFAULT_TASK_MESSAGES,
        timer: DEFAULT_TIMER_MESSAGES,
        commandAliases: { done: "task" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updated).toHaveLength(0);
  });

  it("rejects an under-length overlay token", async () => {
    const { caller: anon } = caller(null);
    await expect(anon.overlay.getTimerState({ token: "short" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("database effects of owner mutations", () => {
  it("task.create derives the author from the authenticated owner", async () => {
    const { caller: owner, inserted } = caller(ownerSession, { tasks: [] });

    await owner.task.create({ text: "write the docs" });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      authorTwitchId: "owner-1",
      authorUsername: "streamer",
      authorDisplayName: "Streamer",
      text: "write the docs",
      priority: 0,
    });
  });

  it("uses the linked Twitch account when a legacy owner row has no custom Twitch ID", async () => {
    const legacyOwnerSession = {
      user: {
        id: "u1",
        isOwner: true,
        name: "streamer",
        twitchId: null,
        displayName: "Streamer",
      },
    };
    const rows = {
      tasks: [],
      user: {
        id: "u1",
        twitchId: null,
        name: "streamer",
        displayName: "Streamer",
      },
      twitchAccount: { accountId: "owner-1" },
    };
    const { caller: owner, inserted } = caller(legacyOwnerSession, rows);

    await owner.task.create({ text: "write the docs" });
    const me = await owner.user.me();

    expect(inserted[0]).toMatchObject({
      authorTwitchId: "owner-1",
      priority: 0,
    });
    expect(me?.twitchId).toBe("owner-1");
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

  it.each([
    ["timer", "overlayTimerToken"],
    ["tasks", "overlayTasksToken"],
  ] as const)(
    "user.regenerateOverlayToken(%s) writes a fresh token to %s and returns it",
    async (type, column) => {
      const { caller: owner, updated } = caller(ownerSession, { instanceConfig: {} });

      const first = await owner.user.regenerateOverlayToken({ type });
      const second = await owner.user.regenerateOverlayToken({ type });

      expect(updated).toEqual([{ [column]: first.token }, { [column]: second.token }]);
      expect(first.token.length).toBeGreaterThanOrEqual(32);
      expect(second.token).not.toBe(first.token);
    },
  );

  it("config.updateTimerConfig persists a valid duration", async () => {
    const { caller: owner, updated } = caller(ownerSession);
    await owner.config.updateTimerConfig({ workDuration: 30 * 60 * 1000 });
    expect(updated.at(-1)).toMatchObject({ workDuration: 30 * 60 * 1000 });
  });

  it("config.updateTimerConfig treats an empty patch as a no-op, not a 500", async () => {
    const { caller: owner, updated } = caller(ownerSession);
    await expect(owner.config.updateTimerConfig({})).resolves.toBeDefined();
    expect(updated).toHaveLength(0);
  });

  it("config.updateStyles writes styles and labels in ONE batch", async () => {
    const { caller: owner, updated, batches } = caller(ownerSession);

    await owner.config.updateStyles({
      timerStyles: { background: { color: "#112233" } },
      taskStyles: { display: { showDone: false } },
      phaseLabels: { ...DEFAULT_PHASE_LABELS, work: "Hunt" },
    });

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
    expect(updated).toEqual([
      { bgColor: "#112233" },
      { displayShowDone: false },
      expect.objectContaining({ labelWork: "Hunt" }),
    ]);
  });

  it("config.updateStyles skips style groups with nothing to write", async () => {
    const { caller: owner, updated, batches } = caller(ownerSession);

    await owner.config.updateStyles({
      timerStyles: {},
      taskStyles: { display: {} },
      phaseLabels: DEFAULT_PHASE_LABELS,
    });

    // Only the labels statement — an empty SET would be a SQL error.
    expect(batches[0]).toHaveLength(1);
    expect(updated).toEqual([expect.objectContaining({ labelWork: DEFAULT_PHASE_LABELS.work })]);
  });

  it("config.updateBotSettings persists messages and canonical aliases in one write", async () => {
    const { caller: owner, updated } = caller(ownerSession);

    await owner.config.updateBotSettings({
      taskCommandsEnabled: false,
      timerCommandsEnabled: true,
      task: { ...DEFAULT_TASK_MESSAGES, notMod: "mods only, {user}" },
      timer: DEFAULT_TIMER_MESSAGES,
      commandAliases: { "!T": "!task" },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      taskCommandsEnabled: false,
      timerCommandsEnabled: true,
      commandAliases: { t: "task" },
      msgNotMod: "mods only, {user}",
    });
  });

  it("token rotation saves the token it returns", async () => {
    const { caller: owner, updated } = caller(ownerSession, { instanceConfig: {} });

    const { token } = await owner.user.regenerateOverlayToken({ type: "tasks" });
    const { botToken } = await owner.bot.regenerateBotToken();

    expect(updated).toEqual([{ overlayTasksToken: token }, { botToken }]);
  });

  it("token rotation fails loudly when the write did not land", async () => {
    const { caller: owner } = caller(ownerSession, { instanceConfig: {}, updateReturns: [] });
    await expect(owner.user.regenerateOverlayToken({ type: "timer" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

describe("bot.ingest broadcaster recognition", () => {
  const token = "b".repeat(32);
  const botConfig = {
    ...PROVISIONED.botConfig,
    taskCommandsEnabled: true,
    timerCommandsEnabled: true,
    msgNotMod: "not a mod",
    msgCommandSuccess: "done",
  };

  it("treats the owner as broadcaster via the linked Twitch account when twitchId is unset", async () => {
    const { caller: anon } = caller(null, {
      instanceConfig: { botToken: token },
      botConfig,
      user: { id: "u1", twitchId: null, name: "streamer", displayName: null },
      twitchAccount: { accountId: "4242" },
    });

    const result = await anon.bot.ingest({
      token,
      username: "streamer",
      twitchId: "4242",
      message: "!timer reset",
    });

    expect(result.replies).toEqual(["done"]);
  });

  it("still refuses a non-mod viewer", async () => {
    const { caller: anon } = caller(null, {
      instanceConfig: { botToken: token },
      botConfig,
      user: { id: "u1", twitchId: null, name: "streamer", displayName: null },
      twitchAccount: { accountId: "4242" },
    });

    const result = await anon.bot.ingest({
      token,
      username: "viewer",
      twitchId: "777",
      message: "!timer reset",
    });

    expect(result.replies).toEqual(["not a mod"]);
  });
});

describe("error behaviour", () => {
  it("bot.getSession rejects an invalid bot token as UNAUTHORIZED", async () => {
    const { caller: anon } = caller(null, {
      instanceConfig: { botToken: "b".repeat(32) },
    });
    await expect(anon.bot.getSession({ token: "z".repeat(32) })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("bot.ingest rejects clearchat without a target username", async () => {
    const token = "b".repeat(32);
    const { caller: anon } = caller(null, { instanceConfig: { botToken: token } });
    await expect(anon.bot.ingest({ token, kind: "clearchat" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
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
    expect(result?.counts).toEqual({ open: 1, done: 0 });
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
