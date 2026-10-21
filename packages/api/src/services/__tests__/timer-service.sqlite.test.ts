import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { TIMER_CONFIG_DEFAULTS } from "@dirework/db/defaults";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { provisionSingletonRows } from "@dirework/db/provision";

import { handleMessage } from "../../bot/commands";
import { buildBotConfig } from "../../config-shared";
import {
  pauseTimer,
  pauseTimerWithResult,
  resetTimer,
  resumeTimer,
  resumeTimerWithResult,
  skipTimer,
  skipTimerWithResult,
  startTimer,
} from "../timer-service";

/**
 * The timer state machine against a real SQLite engine with the D1 migrations
 * applied. A mock ignores WHERE clauses, so only here does the compare-and-swap
 * in casTimer (guarded on status / currentCycle / targetEndTime equality) get
 * evaluated — including whether a timestamp_ms value read back from storage
 * still compares equal when it is bound into the guard.
 */

let db: DbClient;
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

// A non-round millisecond value, so the guard's timestamp equality is real.
const T0 = 1_700_000_000_123;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  ({ db, sqlite } = await createSqliteDb());
});

afterEach(() => {
  vi.useRealTimers();
});

interface RawTimerRow {
  status: string;
  current_cycle: number;
  total_cycles: number;
  target_end_time: number | null;
  paused_with_remaining: number | null;
  paused_from_status: string | null;
}

/** Read the stored row straight from SQLite, bypassing drizzle's mapping. */
function rawTimer(): RawTimerRow {
  const stmt = sqlite.prepare(
    "SELECT status, current_cycle, total_cycles, target_end_time, paused_with_remaining, paused_from_status FROM timer_state",
  );
  try {
    expect(stmt.step()).toBe(true);
    return stmt.getAsObject() as unknown as RawTimerRow;
  } finally {
    stmt.free();
  }
}

/**
 * Run `sideEffect` the moment the service prepares its guarded UPDATE on
 * timer_state — i.e. after it read the row and before its write executes.
 * Fires once.
 */
function interleaveBeforeTimerUpdate(sideEffect: () => void) {
  let fired = false;
  const prepare = sqlite.prepare.bind(sqlite);
  sqlite.prepare = (source, params) => {
    if (!fired && /^update "timer_state"/i.test(source)) {
      fired = true;
      sideEffect();
    }
    return prepare(source, params);
  };
  return () => fired;
}

describe("timer state transitions against real rows", () => {
  it("start → pause → resume → skip → reset", async () => {
    await startTimer(db);
    expect(rawTimer()).toMatchObject({
      status: "starting",
      current_cycle: 1,
      total_cycles: TIMER_CONFIG_DEFAULTS.defaultCycles,
      target_end_time: T0 + TIMER_CONFIG_DEFAULTS.startingDuration,
      paused_with_remaining: null,
      paused_from_status: null,
    });

    // Pause 1s in: the CAS guard bound the stored targetEndTime and matched.
    vi.setSystemTime(T0 + 1000);
    const paused = await pauseTimer(db);
    expect(paused?.status).toBe("paused");
    expect(rawTimer()).toMatchObject({
      status: "paused",
      target_end_time: null,
      paused_with_remaining: TIMER_CONFIG_DEFAULTS.startingDuration - 1000,
      paused_from_status: "starting",
    });

    // Resume much later: remaining time is restored relative to now. The
    // guard's isNull branch (paused → targetEndTime null) must match.
    const resumeAt = T0 + 60_000;
    vi.setSystemTime(resumeAt);
    const resumed = await resumeTimer(db);
    expect(resumed?.status).toBe("starting");
    expect(rawTimer()).toMatchObject({
      status: "starting",
      target_end_time: resumeAt + TIMER_CONFIG_DEFAULTS.startingDuration - 1000,
      paused_with_remaining: null,
      paused_from_status: null,
    });

    const skipped = await skipTimer(db);
    expect(skipped?.status).toBe("work");
    expect(rawTimer()).toMatchObject({
      status: "work",
      current_cycle: 1,
      target_end_time: resumeAt + TIMER_CONFIG_DEFAULTS.workDuration,
    });

    await resetTimer(db);
    expect(rawTimer()).toMatchObject({
      status: "idle",
      current_cycle: 1,
      total_cycles: TIMER_CONFIG_DEFAULTS.defaultCycles,
      target_end_time: null,
      paused_with_remaining: null,
      paused_from_status: null,
    });
  });

  it("skip from a paused timer advances from its pre-pause phase", async () => {
    await startTimer(db);
    await pauseTimer(db);

    const skipped = await skipTimer(db);

    expect(skipped?.status).toBe("work");
    expect(rawTimer()).toMatchObject({
      status: "work",
      target_end_time: T0 + TIMER_CONFIG_DEFAULTS.workDuration,
      paused_with_remaining: null,
      paused_from_status: null,
    });
  });
});

describe("casTimer compare-and-swap", () => {
  it("a pause loses when targetEndTime changed between read and write, and does not overwrite", async () => {
    await startTimer(db);
    const movedEnd = T0 + 42_000;
    const fired = interleaveBeforeTimerUpdate(() => {
      sqlite.run("UPDATE timer_state SET target_end_time = ?", [movedEnd]);
    });

    const result = await pauseTimer(db);

    expect(fired()).toBe(true);
    // The losing call re-read the row: it returns the concurrent writer's state.
    expect(result?.status).toBe("starting");
    expect(result?.targetEndTime?.getTime()).toBe(movedEnd);
    expect(rawTimer()).toMatchObject({
      status: "starting",
      target_end_time: movedEnd,
      paused_with_remaining: null,
      paused_from_status: null,
    });
  });

  it("a skip loses when the phase moved underneath it, so it never double-advances", async () => {
    await startTimer(db);
    // A concurrent writer already moved starting → work, with an end time the
    // stale skip would not compute (it would write now + workDuration).
    const concurrentEnd = T0 + 7_777;
    interleaveBeforeTimerUpdate(() => {
      sqlite.run("UPDATE timer_state SET status = 'work', target_end_time = ?", [concurrentEnd]);
    });

    const result = await skipTimer(db);

    // Without the guard this skip would write "work" computed from the stale
    // "starting" read; with it, the concurrent writer's row survives intact.
    expect(result?.status).toBe("work");
    expect(result?.targetEndTime?.getTime()).toBe(concurrentEnd);
    expect(rawTimer()).toMatchObject({ status: "work", target_end_time: concurrentEnd });
  });

  it("a resume loses when the paused row was resumed concurrently", async () => {
    await startTimer(db);
    await pauseTimer(db);
    const concurrentEnd = T0 + 99_000;
    interleaveBeforeTimerUpdate(() => {
      sqlite.run(
        "UPDATE timer_state SET status = 'starting', target_end_time = ?, paused_with_remaining = NULL, paused_from_status = NULL",
        [concurrentEnd],
      );
    });

    const result = await resumeTimer(db);

    expect(result?.targetEndTime?.getTime()).toBe(concurrentEnd);
    expect(rawTimer()).toMatchObject({ status: "starting", target_end_time: concurrentEnd });
  });
});

describe("timer actions report why nothing changed", () => {
  it("pause: already-paused, not-running, and lost-race", async () => {
    expect(await pauseTimerWithResult(db)).toMatchObject({ changed: false, reason: "not-running" });

    await startTimer(db);
    expect(await pauseTimerWithResult(db)).toMatchObject({ changed: true });
    expect(await pauseTimerWithResult(db)).toMatchObject({
      changed: false,
      reason: "already-paused",
    });

    await resumeTimer(db);
    interleaveBeforeTimerUpdate(() => {
      sqlite.run("UPDATE timer_state SET target_end_time = ?", [T0 + 42_000]);
    });
    const raced = await pauseTimerWithResult(db);
    expect(raced).toMatchObject({ changed: false, reason: "lost-race" });
    expect(raced.row?.targetEndTime?.getTime()).toBe(T0 + 42_000);
  });

  it("resume: not-paused while running, not-running when idle, and lost-race", async () => {
    expect(await resumeTimerWithResult(db)).toMatchObject({
      changed: false,
      reason: "not-running",
    });

    await startTimer(db);
    expect(await resumeTimerWithResult(db)).toMatchObject({ changed: false, reason: "not-paused" });

    await pauseTimer(db);
    interleaveBeforeTimerUpdate(() => {
      sqlite.run(
        "UPDATE timer_state SET status = 'starting', target_end_time = ?, paused_with_remaining = NULL, paused_from_status = NULL",
        [T0 + 99_000],
      );
    });
    expect(await resumeTimerWithResult(db)).toMatchObject({ changed: false, reason: "lost-race" });

    await resetTimer(db);
    expect(await resumeTimerWithResult(db)).toMatchObject({
      changed: false,
      reason: "not-running",
    });
  });

  it("skip: not-running when idle, lost-race when the phase moved underneath it", async () => {
    expect(await skipTimerWithResult(db)).toMatchObject({ changed: false, reason: "not-running" });

    await startTimer(db);
    interleaveBeforeTimerUpdate(() => {
      sqlite.run("UPDATE timer_state SET status = 'work', target_end_time = ?", [T0 + 7_777]);
    });
    expect(await skipTimerWithResult(db)).toMatchObject({ changed: false, reason: "lost-race" });
    expect(rawTimer()).toMatchObject({ status: "work", target_end_time: T0 + 7_777 });
  });

  it("chat says the timer changed instead of 'Done.' when a !timer pause loses the race", async () => {
    await provisionSingletonRows(db);
    const configRow = await db.query.botConfig.findFirst();
    if (!configRow) throw new Error("botConfig not provisioned");
    await startTimer(db);
    interleaveBeforeTimerUpdate(() => {
      sqlite.run("UPDATE timer_state SET target_end_time = ?", [T0 + 42_000]);
    });

    const replies: string[] = [];
    await handleMessage({
      db,
      channelName: "streamer",
      config: buildBotConfig(configRow),
      message: "!timer pause",
      userInfo: {
        twitchId: "1",
        username: "mod",
        displayName: "Mod",
        color: null,
        isBroadcaster: false,
        isMod: true,
      },
      say: (text) => replies.push(text),
    });

    expect(replies).toEqual([
      "The timer changed just before that, so I left it alone. Check it and try again.",
    ]);
    expect(rawTimer()).toMatchObject({ status: "starting", paused_with_remaining: null });
  });
});
