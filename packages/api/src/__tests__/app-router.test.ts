import { describe, expect, it, vi } from "vitest";

import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  twitchAuthorColorSchema,
} from "../config-shared";
import type { Context } from "../context";
import { botIngestInputSchema } from "../routers/bot";
import { appRouter } from "../routers/index";
import { MAX_OPEN_TASKS } from "../config-defaults";
import { taskRestoreInput } from "../routers/input-schemas";
import { TASK_LIST_FULL_MESSAGE } from "../routers/task";
import { createSqliteDb } from "./helpers/sqlite-db";

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
  botConfig: { id: "singleton", commandAliases: {}, muted: false, blockedViewers: [] },
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
        // The bounded done-task read is the only task findMany with an
        // `orderBy`; seeded rows are open tasks, so it sees none (real SQL is
        // covered by the sqlite suites).
        findMany: async (args?: { orderBy?: unknown }) =>
          args?.orderBy === undefined ? (rows.tasks ?? []) : [],
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
      // INSERT … SELECT (task.restore): the SQL itself is covered by the sqlite suite.
      select: () => {
        inserted.push({ kind: "insert-select" });
        return { onConflictDoNothing: () => ({ returning: async () => [{ id: "restored" }] }) };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updated.push(values);
        return {
          where: () => ({
            kind: "update",
            // Still tagged after .returning(), so a batch of guarded UPDATEs is recorded.
            returning: () =>
              Object.assign(Promise.resolve(rows.updateReturns ?? [{ id: "row", ...values }]), {
                kind: "update",
              }),
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        // Awaitable as-is (singleton reads) or grouped (done counts per author).
        where: () =>
          Object.assign(Promise.resolve([{ id: "singleton" }]), { groupBy: async () => [] }),
      }),
    }),
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
  "bot.heartbeat",
  "bot.ingest",
  "bot.release",
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

describe("task.restore (undo of a dashboard removal)", () => {
  const removedTask = {
    id: "t1",
    authorTwitchId: "100",
    authorUsername: "viewer",
    authorDisplayName: "Viewer",
    authorColor: "#ff00aa",
    text: "write the docs",
    status: "active" as const,
    priority: 1,
    order: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  };

  it("rejects anonymous callers and non-owners before touching the DB", async () => {
    const anon = caller(null);
    await expect(anon.caller.task.restore(removedTask)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const rando = caller(nonOwnerSession);
    await expect(rando.caller.task.restore(removedTask)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect([...anon.inserted, ...rando.inserted]).toHaveLength(0);
  });

  it("lets the owner restore a removed task", async () => {
    const { caller: owner, inserted } = caller(ownerSession);
    await expect(owner.task.restore(removedTask)).resolves.toEqual({ id: "restored" });
    expect(inserted).toEqual([{ kind: "insert-select" }]);
  });

  it("rejects an author colour that is not #rrggbb (it reaches overlay CSS)", async () => {
    const { caller: owner, inserted } = caller(ownerSession);
    await expect(
      owner.task.restore({ ...removedTask, authorColor: "red;background:url(x)" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(inserted).toHaveLength(0);
  });
});

describe("task.create and task.restore against real SQLite", () => {
  const OWNER = {
    id: "u1",
    name: "streamer",
    email: "owner@example.test",
    twitchId: "owner-1",
    displayName: "Streamer",
    isOwner: true,
  };

  async function claimedInstance(
    owner: typeof OWNER | (Omit<typeof OWNER, "twitchId"> & { twitchId: null }) = OWNER,
  ) {
    const { db } = await createSqliteDb();
    await provisionSingletonRows(db);
    await db.insert(schema.user).values(owner);
    const caller = appRouter.createCaller({
      session: { user: { ...owner } },
      db,
    } as unknown as Context);
    return { db, owner: caller };
  }

  async function fillOpenTasks(db: Awaited<ReturnType<typeof createSqliteDb>>["db"], n: number) {
    await db.insert(schema.task).values(
      Array.from({ length: n }, (_, i) => ({
        id: `fill-${i}`,
        authorTwitchId: String(5000 + i),
        authorUsername: `viewer${i}`,
        authorDisplayName: `Viewer${i}`,
        text: `task ${i}`,
        status: "pending",
        priority: 1,
        order: i + 1,
      })),
    );
  }

  it("task.create derives the author from the authenticated owner", async () => {
    const { db, owner } = await claimedInstance();

    await owner.task.create({ text: "write the docs" });

    const rows = await db.query.task.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      authorTwitchId: "owner-1",
      authorUsername: "streamer",
      authorDisplayName: "Streamer",
      text: "write the docs",
      priority: 0,
      status: "active",
    });
  });

  it("uses the linked Twitch account when a legacy owner row has no custom Twitch ID", async () => {
    const { db, owner } = await claimedInstance({ ...OWNER, twitchId: null });
    const now = new Date();
    await db.insert(schema.account).values({
      id: "acct",
      accountId: "owner-1",
      providerId: "twitch",
      userId: OWNER.id,
      createdAt: now,
      updatedAt: now,
    });

    await owner.task.create({ text: "write the docs" });
    const me = await owner.user.me();

    const [row] = await db.query.task.findMany();
    expect(row).toMatchObject({ authorTwitchId: "owner-1", priority: 0 });
    expect(me?.twitchId).toBe("owner-1");
  });

  it("strips bidi overrides and zero-width characters from dashboard task text", async () => {
    const { db, owner } = await claimedInstance();

    await owner.task.create({ text: "\u202Eabc\u200B def" });

    const [row] = await db.query.task.findMany();
    expect(row?.text).toBe("abc def");
  });

  it("refuses task text that is only invisible characters", async () => {
    const { db, owner } = await claimedInstance();

    await expect(owner.task.create({ text: "\u200B\u202E\u2066" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await db.query.task.findMany()).toHaveLength(0);
  });

  it("task.create refuses a new task once the list holds MAX_OPEN_TASKS", async () => {
    const { db, owner } = await claimedInstance();
    await fillOpenTasks(db, MAX_OPEN_TASKS);

    await expect(owner.task.create({ text: "one too many" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: TASK_LIST_FULL_MESSAGE,
    });
    expect(await db.$count(schema.task)).toBe(MAX_OPEN_TASKS);
  });

  const removed = {
    id: "gone",
    authorTwitchId: "100",
    authorUsername: "viewer",
    authorDisplayName: "Viewer",
    authorColor: null,
    text: "write the docs",
    status: "pending" as const,
    priority: 1,
    order: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
  };

  it("task.restore refuses an open task once the list is full, but not a done one", async () => {
    const { db, owner } = await claimedInstance();
    await fillOpenTasks(db, MAX_OPEN_TASKS);

    await expect(owner.task.restore(removed)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(
      owner.task.restore({
        ...removed,
        status: "done",
        completedAt: new Date().toISOString(),
      }),
    ).resolves.toMatchObject({ id: "gone", status: "done" });
  });

  it("task.restore of an id that is already back is a quiet no-op", async () => {
    const { owner } = await claimedInstance();

    await expect(owner.task.restore(removed)).resolves.toMatchObject({ id: "gone" });
    await expect(owner.task.restore(removed)).resolves.toBeNull();
  });

  it("task.restore accepts the owner's own non-Twitch author key and name", async () => {
    // A local dev owner has no Twitch account: dashboard tasks carry the user id and name.
    const devOwner = { ...OWNER, id: "devownerid123", name: "Wolf Streamer", twitchId: null };
    const { owner } = await claimedInstance(devOwner);

    await expect(
      owner.task.restore({
        ...removed,
        authorTwitchId: "devownerid123",
        authorUsername: "Wolf Streamer",
        authorDisplayName: "Wolf Streamer",
      }),
    ).resolves.toMatchObject({ id: "gone", authorTwitchId: "devownerid123" });
  });

  it.each([
    ["a non-numeric id that is not the owner's", { authorTwitchId: "someoneelse" }],
    ["a login with spaces that is not the owner's name", { authorUsername: "not a login" }],
  ])("task.restore rejects %s", async (_label, patch) => {
    const { db, owner } = await claimedInstance();

    await expect(owner.task.restore({ ...removed, ...patch })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await db.query.task.findMany()).toHaveLength(0);
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

  it("rejects an unknown setup step and extra keys, writing nothing", async () => {
    const { caller: owner, updated } = caller(ownerSession, { instanceConfig: {} });
    await expect(
      // @ts-expect-error — not a checklist step
      owner.user.confirmSetupStep({ step: "botAccount", confirmed: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      // @ts-expect-error — strict schema: no extra keys
      owner.user.confirmSetupStep({ step: "botSource", confirmed: true, channelLogin: "x" }),
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
    ["timer", "overlayTimerToken", "setupTimerOverlayConfirmed"],
    ["tasks", "overlayTasksToken", "setupTasksOverlayConfirmed"],
  ] as const)(
    "user.regenerateOverlayToken(%s) writes a fresh token to %s and un-confirms %s",
    async (type, column, setupColumn) => {
      const { caller: owner, updated } = caller(ownerSession, { instanceConfig: {} });

      const first = await owner.user.regenerateOverlayToken({ type });
      const second = await owner.user.regenerateOverlayToken({ type });

      // One UPDATE per reset: the old URL in OBS is dead, so its setup step is cleared.
      expect(updated).toEqual([
        { [column]: first.token, [setupColumn]: false },
        { [column]: second.token, [setupColumn]: false },
      ]);
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

  it("config.setBotMuted writes only the mute flag", async () => {
    const { caller: owner, updated } = caller(ownerSession);

    await expect(owner.config.setBotMuted({ muted: true })).resolves.toEqual({ muted: true });
    expect(updated).toEqual([{ muted: true }]);
  });

  it("config.blockViewer refuses the streamer and writes nothing", async () => {
    const { caller: owner, batches, updated } = caller(ownerSession);

    await expect(owner.config.blockViewer({ login: "@Streamer" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(batches).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it.each(["", "bad name", "x".repeat(27), "émoji"])(
    "config.blockViewer rejects the invalid login %j",
    async (login) => {
      const { caller: owner, batches } = caller(ownerSession);
      await expect(owner.config.blockViewer({ login })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(batches).toHaveLength(0);
    },
  );

  it.each([
    ["botSource", "setupBotSourceConfirmed"],
    ["timerOverlay", "setupTimerOverlayConfirmed"],
    ["tasksOverlay", "setupTasksOverlayConfirmed"],
  ] as const)(
    "user.confirmSetupStep(%s) writes only %s and returns the checklist",
    async (step, column) => {
      const { caller: owner, updated } = caller(ownerSession, { instanceConfig: {} });

      const confirmed = await owner.user.confirmSetupStep({ step, confirmed: true });
      const reverted = await owner.user.confirmSetupStep({ step, confirmed: false });

      // One UPDATE per click, touching exactly the one column.
      expect(updated).toEqual([{ [column]: true }, { [column]: false }]);
      expect(confirmed.setup[step]).toBe(true);
      expect(Object.values(confirmed.setup).filter(Boolean)).toHaveLength(1);
      expect(reverted.setup[step]).toBe(false);
    },
  );

  it("user.confirmSetupStep fails loudly when the write did not land", async () => {
    const { caller: owner } = caller(ownerSession, { instanceConfig: {}, updateReturns: [] });
    await expect(
      owner.user.confirmSetupStep({ step: "botSource", confirmed: true }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("user.confirmSetupStep refuses a signed-in non-owner before touching the DB", async () => {
    const { caller: rando, updated } = caller(nonOwnerSession, { instanceConfig: {} });
    await expect(
      rando.user.confirmSetupStep({ step: "botSource", confirmed: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updated).toHaveLength(0);
  });

  it("token rotation saves the token it returns", async () => {
    const { caller: owner, updated } = caller(ownerSession, { instanceConfig: {} });

    const { token } = await owner.user.regenerateOverlayToken({ type: "tasks" });
    const { botToken, chatToken } = await owner.bot.regenerateBotToken();

    expect(updated).toEqual([
      { overlayTasksToken: token, setupTasksOverlayConfirmed: false },
      // The same UPDATE frees the bot page lease the old URL's page held.
      {
        botToken,
        setupBotSourceConfirmed: false,
        botLeaseInstanceId: null,
        botLeaseSeenAt: null,
      },
    ]);
    // No bot account connected: only the URL rotates, nothing to revoke.
    expect(chatToken).toBe("no-account");
  });

  it("token rotation fails loudly when the write did not land", async () => {
    const { caller: owner } = caller(ownerSession, { instanceConfig: {}, updateReturns: [] });
    await expect(owner.user.regenerateOverlayToken({ type: "timer" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

describe("Twitch author color: one policy for chat ingest and task restore", () => {
  const token = "b".repeat(32);
  const injections = ["red;background:url(x)", "#fff}body{display:none", "url(https://evil.test)"];

  it("both input schemas use the shared twitchAuthorColorSchema", () => {
    expect(botIngestInputSchema.shape.color.unwrap()).toBe(twitchAuthorColorSchema);
    expect(taskRestoreInput.shape.authorColor.unwrap()).toBe(twitchAuthorColorSchema);
  });

  it.each(injections)("bot.ingest rejects %s", async (color) => {
    const { caller: anon, inserted } = caller(null, { instanceConfig: { botToken: token } });
    await expect(
      anon.bot.ingest({ token, username: "viewer", twitchId: "777", message: "!task x", color }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(inserted).toHaveLength(0);
  });

  it.each(injections)("task.restore rejects %s", async (authorColor) => {
    const { caller: owner, inserted } = caller(ownerSession);
    await expect(
      owner.task.restore({
        id: "t1",
        authorTwitchId: "100",
        authorUsername: "viewer",
        authorDisplayName: "Viewer",
        authorColor,
        text: "write the docs",
        status: "pending",
        priority: 1,
        order: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        completedAt: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(inserted).toHaveLength(0);
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

describe("task.activate error mapping", () => {
  it("refuses to activate a done task with BAD_REQUEST and writes nothing", async () => {
    const {
      caller: owner,
      updated,
      batches,
    } = caller(ownerSession, {
      tasks: [{ id: "t1", authorTwitchId: "100", status: "done" }],
    });

    await expect(owner.task.activate({ id: "t1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(updated).toHaveLength(0);
    expect(batches).toHaveLength(0);
  });

  it("maps an unknown task id to NOT_FOUND and writes nothing", async () => {
    const { caller: owner, updated, batches } = caller(ownerSession, { tasks: [] });

    await expect(owner.task.activate({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(updated).toHaveLength(0);
    expect(batches).toHaveLength(0);
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
    expect(result?.counts).toEqual({ open: 1, done: 0, doneByAuthor: {} });
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

describe("setup checklist against real SQLite", () => {
  const OWNER = {
    id: "owner",
    name: "streamer",
    email: "owner@example.test",
    twitchId: "1000",
    displayName: "Streamer",
    isOwner: true,
  };
  const session = {
    user: {
      id: OWNER.id,
      isOwner: true,
      name: OWNER.name,
      twitchId: OWNER.twitchId,
      displayName: OWNER.displayName,
    },
  };
  const NONE = { botSource: false, timerOverlay: false, tasksOverlay: false };

  /** A claimed instance: provisioned singletons plus the owner row the session names. */
  async function claimedInstance() {
    const { db } = await createSqliteDb();
    await provisionSingletonRows(db);
    await db.insert(schema.user).values(OWNER);
    return { db, owner: appRouter.createCaller({ session, db } as unknown as Context) };
  }

  it("me.setup is all false until a step is confirmed, and reverts when un-confirmed", async () => {
    const { db, owner } = await claimedInstance();
    const before = await db.query.instanceConfig.findFirst();

    expect((await owner.user.me())?.setup).toEqual(NONE);

    await expect(
      owner.user.confirmSetupStep({ step: "timerOverlay", confirmed: true }),
    ).resolves.toEqual({ setup: { ...NONE, timerOverlay: true } });
    expect((await owner.user.me())?.setup).toEqual({ ...NONE, timerOverlay: true });

    await owner.user.confirmSetupStep({ step: "tasksOverlay", confirmed: true });
    expect((await owner.user.me())?.setup).toEqual({
      ...NONE,
      timerOverlay: true,
      tasksOverlay: true,
    });

    await owner.user.confirmSetupStep({ step: "timerOverlay", confirmed: false });
    await owner.user.confirmSetupStep({ step: "tasksOverlay", confirmed: false });
    expect((await owner.user.me())?.setup).toEqual(NONE);

    // Nothing else on the row moved: tokens and the cached channel are as provisioned.
    expect(await db.query.instanceConfig.findFirst()).toEqual(before);
  });
});

describe("config.blockViewer against real SQLite", () => {
  // The owner's name ("Streamer Name") is not their login; the bot page cached the
  // real login on instance_config, which is what the block list must refuse.
  const OWNER = {
    id: "owner",
    name: "Streamer Name",
    email: "owner@example.test",
    twitchId: "1000",
    displayName: "Streamer Name",
    isOwner: true,
  };
  const session = { user: { id: OWNER.id, isOwner: true, name: OWNER.name, twitchId: "1000" } };
  type SqliteDb = Awaited<ReturnType<typeof createSqliteDb>>["db"];

  async function claimedInstance() {
    const { db } = await createSqliteDb();
    await provisionSingletonRows(db);
    await db.insert(schema.user).values(OWNER);
    await db.update(schema.instanceConfig).set({ channelLogin: "realstreamer" });
    await db.insert(schema.task).values([
      {
        id: "v1",
        authorTwitchId: "2000",
        authorUsername: "viewer",
        authorDisplayName: "Viewer",
        text: "a",
        status: "active",
        order: 1,
      },
      {
        id: "o1",
        authorTwitchId: "3000",
        authorUsername: "other",
        authorDisplayName: "Other",
        text: "b",
        status: "active",
        order: 2,
      },
    ]);
    return { db, owner: appRouter.createCaller({ session, db } as unknown as Context) };
  }

  const blocked = async (db: SqliteDb) => (await db.query.botConfig.findFirst())?.blockedViewers;
  const taskIds = async (db: SqliteDb) =>
    (await db.query.task.findMany({ columns: { id: true } })).map((t) => t.id).sort();

  it("normalizes the login, lists it, and removes only that viewer's tasks", async () => {
    const { db, owner } = await claimedInstance();

    await expect(owner.config.blockViewer({ login: "@Viewer" })).resolves.toEqual({
      login: "viewer",
    });
    expect(await blocked(db)).toEqual(["viewer"]);
    expect(await taskIds(db)).toEqual(["o1"]);
  });

  it("refuses the streamer's cached login even when their name differs", async () => {
    const { db, owner } = await claimedInstance();

    await expect(owner.config.blockViewer({ login: "@RealStreamer" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You can't block the streamer",
    });
    expect(await blocked(db)).toEqual([]);
  });

  it("reports an already-blocked login as CONFLICT instead of success", async () => {
    const { db, owner } = await claimedInstance();
    await db.update(schema.botConfig).set({ blockedViewers: ["viewer"] });

    await expect(owner.config.blockViewer({ login: "viewer" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "viewer is already blocked",
    });
    expect(await blocked(db)).toEqual(["viewer"]);
  });

  it("reports a full list as BAD_REQUEST and keeps the viewer's tasks", async () => {
    const { db, owner } = await claimedInstance();
    const full = Array.from({ length: 200 }, (_, i) => `name${i}`);
    await db.update(schema.botConfig).set({ blockedViewers: full });

    await expect(owner.config.blockViewer({ login: "viewer" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await blocked(db)).toEqual(full);
    expect(await taskIds(db)).toEqual(["o1", "v1"]);
  });
});

describe("config.updateStyles against real SQLite (style default upgrade)", () => {
  const session = {
    user: { id: "owner", isOwner: true, name: "streamer", twitchId: "1000", displayName: "S" },
  };

  it("a one-field edit of a never-customized group keeps the group's current defaults", async () => {
    const { db } = await createSqliteDb();
    // Fresh rows hold the frozen SQL column defaults (the old 8px ring).
    await provisionSingletonRows(db);
    const owner = appRouter.createCaller({ session, db } as unknown as Context);

    const saved = await owner.config.updateStyles({
      timerStyles: { ring: { fillColor: "#ff0000" } },
      taskStyles: {},
      phaseLabels: DEFAULT_PHASE_LABELS,
    });
    expect(saved.timerStyles.ring).toMatchObject({ width: 14, gap: 10, fillColor: "#ff0000" });

    // Stable on later reads: the group was written whole, so nothing reverts.
    const read = await owner.config.get();
    expect(read.timerStyles.ring).toMatchObject({ width: 14, gap: 10, fillColor: "#ff0000" });
    const row = await db.query.timerStyle.findFirst();
    expect(row).toMatchObject({ ringWidth: 14, ringGap: 10, ringFillColor: "#ff0000" });
    // Untouched groups are not written: they keep upgrading on read.
    expect(row?.fontSizeTime).toBe("48px");
    expect(read.timerStyles.fontSizes.time).toBe("64px");
  });
});

describe("config.updateBotSettings partial saves against real SQLite", () => {
  const session = {
    user: { id: "owner", isOwner: true, name: "streamer", twitchId: "1000", displayName: "S" },
  };

  /** A customised instance, so "left alone" is distinguishable from "reset to default". */
  async function customised() {
    const { db } = await createSqliteDb();
    await provisionSingletonRows(db);
    const owner = appRouter.createCaller({ session, db } as unknown as Context);
    await owner.config.updateBotSettings({
      taskCommandsEnabled: true,
      timerCommandsEnabled: true,
      task: { ...DEFAULT_TASK_MESSAGES, notMod: "mods only, {user}" },
      timer: { ...DEFAULT_TIMER_MESSAGES, eta: "Done at {time}" },
      commandAliases: { t: "task" },
    });
    return { db, owner };
  }

  it("a replies-only save leaves the aliases and both switches alone", async () => {
    const { db, owner } = await customised();
    await owner.config.updateBotSettings({ timerCommandsEnabled: false });

    await owner.config.updateBotSettings({
      task: { ...DEFAULT_TASK_MESSAGES, notMod: "nope" },
      timer: DEFAULT_TIMER_MESSAGES,
    });

    const row = await db.query.botConfig.findFirst();
    expect(row).toMatchObject({
      msgNotMod: "nope",
      commandAliases: { t: "task" },
      taskCommandsEnabled: true,
      timerCommandsEnabled: false,
    });
    const read = await owner.config.get();
    expect(read.botConfig.timer.eta).toBe(DEFAULT_TIMER_MESSAGES.eta);
  });

  it("an aliases-only save leaves every reply alone", async () => {
    const { owner } = await customised();

    await owner.config.updateBotSettings({ commandAliases: { "!d": "!done" } });

    const read = await owner.config.get();
    expect(read.botConfig.commandAliases).toEqual({ d: "done" });
    expect(read.botConfig.task.notMod).toBe("mods only, {user}");
    expect(read.botConfig.timer.eta).toBe("Done at {time}");
  });

  it("one switch writes only that switch", async () => {
    const { owner } = await customised();

    const saved = await owner.config.updateBotSettings({ taskCommandsEnabled: false });

    expect(saved).toMatchObject({ taskCommandsEnabled: false, timerCommandsEnabled: true });
    expect(saved.commandAliases).toEqual({ t: "task" });
    expect(saved.task.notMod).toBe("mods only, {user}");
  });

  it("rejects a save with nothing in it", async () => {
    const { owner } = await customised();
    await expect(owner.config.updateBotSettings({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("saves who can add tasks on its own and reads it back", async () => {
    const { db, owner } = await customised();
    expect((await owner.config.get()).botConfig.taskAccess).toBe("everyone");

    const saved = await owner.config.updateBotSettings({ taskAccess: "subscribers" });

    expect(saved.taskAccess).toBe("subscribers");
    expect(saved.task.notMod).toBe("mods only, {user}");
    expect((await db.query.botConfig.findFirst())?.taskAccess).toBe("subscribers");
  });

  it("rejects an unknown task access level, writing nothing", async () => {
    const { db, owner } = await customised();
    await expect(
      // @ts-expect-error — not a level
      owner.config.updateBotSettings({ taskAccess: "friends" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await db.query.botConfig.findFirst())?.taskAccess).toBe("everyone");
  });
});

describe("user.me bot account permissions against real SQLite", () => {
  const session = {
    user: { id: "owner", isOwner: true, name: "streamer", twitchId: "1000", displayName: "S" },
  };

  async function withBot(account: { twitchId: string; scopes?: string[] }) {
    const { db } = await createSqliteDb();
    await provisionSingletonRows(db);
    await db.insert(schema.user).values({
      id: "owner",
      name: "streamer",
      email: "owner@example.test",
      twitchId: "1000",
      displayName: "Streamer",
      isOwner: true,
    });
    await db.insert(schema.botAccount).values({
      username: "direbot",
      displayName: "DireBot",
      accessToken: "secret-access-token",
      refreshToken: "secret-refresh-token",
      expiresAt: new Date(Date.now() + 3_600_000),
      ...account,
    });
    return appRouter.createCaller({ session, db } as unknown as Context);
  }

  it("names the new scopes an older connection lacks, never the tokens or scopes", async () => {
    const owner = await withBot({ twitchId: "4000" });

    const me = await owner.user.me();

    expect(me?.botAccount).toMatchObject({
      username: "direbot",
      missingScopes: ["moderator:read:followers", "moderation:read"],
      isChannelAccount: false,
    });
    expect(me?.botAccount).not.toHaveProperty("scopes");
    expect(JSON.stringify(me)).not.toMatch(/secret-(access|refresh)-token/);
  });

  it("reports nothing missing after a reconnect, and a bot that is the channel's account", async () => {
    const owner = await withBot({
      twitchId: "1000",
      scopes: ["chat:read", "chat:edit", "moderator:read:followers", "moderation:read"],
    });

    expect((await owner.user.me())?.botAccount).toMatchObject({
      missingScopes: [],
      isChannelAccount: true,
    });
  });
});

describe("dashboard stats against real SQLite", () => {
  const OWNER = {
    id: "owner",
    name: "streamer",
    email: "owner@example.test",
    twitchId: "1000",
    displayName: "Streamer",
    isOwner: true,
  };
  const session = { user: { ...OWNER } };

  async function claimedInstance() {
    const { db } = await createSqliteDb();
    await provisionSingletonRows(db);
    await db.insert(schema.user).values(OWNER);
    return { db, owner: appRouter.createCaller({ session, db } as unknown as Context) };
  }

  it("stats.summary starts empty, then counts a task the owner marks done", async () => {
    const { owner } = await claimedInstance();

    const empty = await owner.stats.summary();
    expect(empty.today).toMatchObject({ focusMs: 0, pomodoros: 0, tasksDone: 0 });
    expect(empty.days).toHaveLength(14);
    expect(empty.timeZone).toBe("UTC");

    const task = await owner.task.create({ text: "ship stats" });
    await owner.task.markDone({ id: task?.id ?? "" });

    const after = await owner.stats.summary();
    expect(after.today).toMatchObject({ tasksDone: 1, tasksDoneChat: 0 });
    expect(after.week.tasksDone).toBe(1);
  });

  it("task.markDone completes a task parked as started by a focus switch", async () => {
    const { db, owner } = await claimedInstance();
    const first = await owner.task.create({ text: "first" });
    const second = await owner.task.create({ text: "second" });
    await owner.task.activate({ id: second?.id ?? "" });
    const parked = await db.query.task.findFirst({
      where: (t, { eq }) => eq(t.id, first?.id ?? ""),
    });
    expect(parked?.status).toBe("started");

    expect(await owner.task.markDone({ id: first?.id ?? "" })).toMatchObject({ status: "done" });
    const focus = await db.query.task.findFirst({
      where: (t, { eq }) => eq(t.id, second?.id ?? ""),
    });
    expect(focus?.status).toBe("active");
    expect((await owner.stats.summary()).today.tasksDone).toBe(1);
  });

  it("stats.summary counts phases that ended while nobody was watching", async () => {
    const { db, owner } = await claimedInstance();
    // A work phase that ended a minute ago, never advanced by any poll.
    const overdue = {
      status: "work" as const,
      targetEndTime: new Date(Date.now() - 60_000),
      currentCycle: 1,
    };
    await db
      .insert(schema.timerState)
      .values(overdue)
      .onConflictDoUpdate({ target: schema.timerState.id, set: overdue });

    const summary = await owner.stats.summary();

    expect(summary.today.pomodoros).toBe(1);
    expect(summary.today.focusMs).toBe(1_500_000);
    expect((await owner.timer.get())?.status).toBe("break");
  });

  it("user.setTimeZone stores a valid zone once and me reports it", async () => {
    const { owner } = await claimedInstance();
    expect((await owner.user.me())?.timeZone).toBeNull();

    await expect(owner.user.setTimeZone({ timeZone: "America/Chicago" })).resolves.toEqual({
      timeZone: "America/Chicago",
      changed: true,
    });
    await expect(owner.user.setTimeZone({ timeZone: "America/Chicago" })).resolves.toEqual({
      timeZone: "America/Chicago",
      changed: false,
    });
    expect((await owner.user.me())?.timeZone).toBe("America/Chicago");
    expect((await owner.stats.summary()).timeZone).toBe("America/Chicago");
  });

  it.each(["Mars/Olympus", "", "x".repeat(65)])("user.setTimeZone rejects %j", async (timeZone) => {
    const { owner } = await claimedInstance();
    await expect(owner.user.setTimeZone({ timeZone })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect((await owner.user.me())?.timeZone).toBeNull();
  });
});
