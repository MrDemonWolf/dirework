import { and, eq, isNull } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { SINGLETON_ID } from "@dirework/db/schema";

import type { TimerStatus } from "../config-shared";
import { computeNextPhase, getTimerConfig } from "../routers/timer-logic";
import { updateSingleton } from "./singleton";
import {
  type FocusCredit,
  pruneDailyStats,
  focusCreditStmts,
  type KnownTimeZone,
  resolveStatsTimeZone,
} from "./stats-service";
import { purgeExpiredDoneTasks } from "./task-service";

// Single implementation of the timer state machine mutations (audit M1) —
// called by both the tRPC timer router and the bot ingest path.

export type TimerStateRow = typeof schema.timerState.$inferSelect;

const RUNNING_STATUSES = new Set<string>([
  "starting",
  "work",
  "break",
  "longBreak",
] satisfies TimerStatus[]);

/**
 * Compare-and-swap on the timer singleton, guarded on the exact
 * (status, currentCycle, targetEndTime) that was read. If any of the three
 * changed between read and write — a concurrent overdue-advance or a manual
 * skip — the UPDATE matches no row and returns undefined, so the caller re-reads
 * instead of clobbering. This is what stops a `!timer skip` from acting on stale
 * state and double-advancing past a phase the lazy overdue-advance already moved.
 * targetEndTime is nullable (paused/idle), hence the isNull branch.
 */
function casTimer(
  db: DbClient,
  prev: Pick<TimerStateRow, "status" | "currentCycle" | "targetEndTime">,
  values: SQLiteUpdateSetSource<typeof schema.timerState>,
) {
  return db
    .update(schema.timerState)
    .set(values)
    .where(
      and(
        eq(schema.timerState.id, SINGLETON_ID),
        eq(schema.timerState.status, prev.status),
        eq(schema.timerState.currentCycle, prev.currentCycle),
        prev.targetEndTime === null
          ? isNull(schema.timerState.targetEndTime)
          : eq(schema.timerState.targetEndTime, prev.targetEndTime),
      ),
    )
    .returning();
}

/**
 * `casTimer` plus the focus credits that move earned, in ONE db.batch: each
 * credit upsert is guarded on `changes() > 0` (focusCreditStmts), so it lands
 * only if the CAS matched, and atomically with it. Stats are best-effort: if the
 * batch throws, the CAS is retried alone so the timer still moves.
 */
async function casTimerWithCredits(
  db: DbClient,
  prev: Pick<TimerStateRow, "status" | "currentCycle" | "targetEndTime">,
  values: SQLiteUpdateSetSource<typeof schema.timerState>,
  credits: readonly FocusCredit[],
  timeZone: string | null,
): Promise<TimerStateRow | undefined> {
  if (credits.every((credit) => credit.focusMs <= 0 && credit.pomodoros <= 0)) {
    return (await casTimer(db, prev, values))[0];
  }
  try {
    const [rows] = await db.batch([
      casTimer(db, prev, values),
      ...focusCreditStmts(db, credits, timeZone),
    ]);
    return rows[0];
  } catch {
    return (await casTimer(db, prev, values))[0];
  }
}

/**
 * Lazily advance a timer whose targetEndTime has passed. There is no always-on
 * server on Workers, so phase transitions are driven by reads: every overlay
 * poll, dashboard query, or chat command self-heals the state machine. Each new
 * phase is anchored at the PREVIOUS phase's end time (not Date.now()), so a
 * timer left unattended catches up through multiple missed phases accurately.
 *
 * The catch-up is computed in memory and persisted with ONE guarded UPDATE, so
 * the query count stays constant however many phases were missed (D1 caps
 * queries per Worker invocation). Concurrent pollers race safely: the UPDATE is
 * guarded on the state that was read, and a loser just re-reads.
 *
 * Dashboard stats: every work phase the catch-up walked past ran to its end, so
 * it earns a pomodoro and its full length, on the day it ended. The credits ride
 * in the guarded UPDATE's own batch (`casTimerWithCredits`), so they land only
 * when it wins (two pollers count a phase once) and atomically with it (a reader
 * that sees the advanced timer sees the credits). A poll with nothing overdue
 * reads and writes nothing extra; `timeZone` skips the zone read when known.
 */
export async function maybeAdvanceOverdueTimer(
  db: DbClient,
  opts: { timeZone?: KnownTimeZone } = {},
): Promise<TimerStateRow | null> {
  let timer = (await db.query.timerState.findFirst()) ?? null;
  let loaded: { config: ReturnType<typeof getTimerConfig>; timeZone: string | null } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!timer || !isOverdue(timer)) return timer;

    // Only an overdue timer pays for these two reads, and they run side by side.
    if (!loaded) {
      const [configRow, timeZone] = await Promise.all([
        db.query.timerConfig.findFirst(),
        resolveStatsTimeZone(db, opts.timeZone),
      ]);
      loaded = { config: getTimerConfig(configRow ?? null), timeZone };
    }
    const { credits, ...next } = catchUpOverdue(timer, loaded.config, Date.now());

    const row = await casTimerWithCredits(
      db,
      timer,
      { ...next, pausedFromStatus: null, pausedWithRemaining: null },
      credits,
      loaded.timeZone,
    );
    if (row) return row;

    // Guarded update lost (another poller advanced first) → re-read and retry.
    timer = (await db.query.timerState.findFirst()) ?? null;
  }
  return timer;
}

function isOverdue(timer: TimerStateRow): timer is TimerStateRow & { targetEndTime: Date } {
  return (
    RUNNING_STATUSES.has(timer.status) &&
    timer.targetEndTime !== null &&
    timer.targetEndTime.getTime() <= Date.now()
  );
}

/**
 * Walk the state machine forward from an overdue phase until it reaches a phase
 * that ends after `now` (or one with no end, e.g. finished). Bounded so a
 * pathological config cannot spin: totalCycles is capped at 99, so a full
 * session is well under the guard. `credits` holds one entry per work phase it
 * walked past (each ran to its end), stamped with that phase's end time.
 */
export function catchUpOverdue(
  timer: Pick<TimerStateRow, "status" | "currentCycle" | "totalCycles"> & { targetEndTime: Date },
  tc: ReturnType<typeof getTimerConfig>,
  now: number,
): Pick<TimerStateRow, "status" | "currentCycle" | "targetEndTime"> & {
  credits: FocusCredit[];
} {
  let status = timer.status;
  let currentCycle = timer.currentCycle;
  let targetEndTime: Date | null = timer.targetEndTime;
  const credits: FocusCredit[] = [];

  for (let i = 0; i < 1000 && targetEndTime && targetEndTime.getTime() <= now; i++) {
    if (status === "work") {
      credits.push({ at: targetEndTime.getTime(), focusMs: tc.workDuration, pomodoros: 1 });
    }
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status, currentCycle, totalCycles: timer.totalCycles },
      tc,
    );
    status = nextStatus;
    currentCycle = nextCycle;
    targetEndTime = nextDuration ? new Date(targetEndTime.getTime() + nextDuration) : null;
  }
  return { status, currentCycle, targetEndTime, credits };
}

/**
 * Focus time already spent in the current work phase when it is cut short (skip
 * or reset): the phase length minus what was left, so paused time never counts
 * (a pause freezes the remaining time). 0 outside a work phase; clamped to the
 * phase length.
 */
export function workedMs(
  timer: Pick<
    TimerStateRow,
    "status" | "pausedFromStatus" | "pausedWithRemaining" | "targetEndTime"
  >,
  workDuration: number,
  now: number,
): number {
  const paused = timer.status === "paused";
  if ((paused ? timer.pausedFromStatus : timer.status) !== "work") return 0;
  const remaining = paused
    ? (timer.pausedWithRemaining ?? workDuration)
    : timer.targetEndTime
      ? timer.targetEndTime.getTime() - now
      : workDuration;
  return Math.min(workDuration, Math.max(0, workDuration - remaining));
}

/**
 * Options for the stats-recording timer actions. `timeZone`: the owner's zone when
 * the caller already has it (bot ingest reads it with the token gate), so a chat
 * command adds no instance_config read; omitted, it is read when needed.
 */
export interface TimerStatsOpts {
  timeZone?: KnownTimeZone;
}

export async function getTimerState(
  db: DbClient,
  opts: TimerStatsOpts = {},
): Promise<TimerStateRow | null> {
  return maybeAdvanceOverdueTimer(db, opts);
}

async function loadTimerConfig(db: DbClient) {
  const timerConfigRow = await db.query.timerConfig.findFirst();
  return getTimerConfig(timerConfigRow ?? null);
}

/** Start (or restart) the timer in the "starting" phase. */
export async function startTimer(db: DbClient, opts?: { totalCycles?: number }) {
  // A session boundary is a natural moment for the retention purges.
  const [tc] = await Promise.all([
    loadTimerConfig(db),
    purgeExpiredDoneTasks(db),
    pruneDailyStats(db),
  ]);

  const values = {
    status: "starting" as const,
    targetEndTime: new Date(Date.now() + tc.startingDuration),
    pausedWithRemaining: null,
    pausedFromStatus: null,
    currentCycle: 1,
    totalCycles: opts?.totalCycles ?? tc.defaultCycles,
  };

  const [row] = await db
    .insert(schema.timerState)
    .values(values)
    .onConflictDoUpdate({ target: schema.timerState.id, set: values })
    .returning();
  return row ?? null;
}

/**
 * What a pause/resume/skip did. `changed: false` carries why nothing happened,
 * so the chat path can say "already paused" instead of a misleading "Done." or
 * "isn't running". `row` is the timer as it stands afterwards (null when there
 * is no timer row at all). `lost-race` means the guarded UPDATE matched no row
 * because something else moved the timer between our read and our write.
 */
export type TimerActionResult<Reason extends string> =
  | { changed: true; row: TimerStateRow }
  | { changed: false; reason: Reason | "lost-race"; row: TimerStateRow | null };

export type PauseNoopReason = "not-running" | "already-paused";
export type ResumeNoopReason = "not-running" | "not-paused";
export type SkipNoopReason = "not-running";

/** Re-read after a lost compare-and-swap, so callers see the state that won. */
async function lostRace(db: DbClient): Promise<{
  changed: false;
  reason: "lost-race";
  row: TimerStateRow | null;
}> {
  return {
    changed: false,
    reason: "lost-race",
    row: (await db.query.timerState.findFirst()) ?? null,
  };
}

/** Pause a running timer, storing the remaining milliseconds. */
export async function pauseTimerWithResult(
  db: DbClient,
  opts: TimerStatsOpts = {},
): Promise<TimerActionResult<PauseNoopReason>> {
  const timer = await getTimerState(db, opts);
  if (timer?.status === "paused") return { changed: false, reason: "already-paused", row: timer };
  if (!timer?.targetEndTime) return { changed: false, reason: "not-running", row: timer };

  const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());

  const [row] = await casTimer(db, timer, {
    status: "paused",
    pausedFromStatus: timer.status,
    pausedWithRemaining: remaining,
    targetEndTime: null,
  });
  return row ? { changed: true, row } : lostRace(db);
}

/**
 * Dashboard shape of {@link pauseTimerWithResult}: the row after the pause (or
 * the current row when a concurrent action won the race), null when there was
 * nothing to pause.
 */
export async function pauseTimer(db: DbClient) {
  return rowOrNull(await pauseTimerWithResult(db));
}

/**
 * Resume a paused timer. M2 fix: nullish check — a timer paused with exactly
 * 0ms remaining must still resume (the old falsy check left it stuck forever).
 */
export async function resumeTimerWithResult(
  db: DbClient,
  opts: TimerStatsOpts = {},
): Promise<TimerActionResult<ResumeNoopReason>> {
  const timer = await getTimerState(db, opts);
  if (timer?.pausedWithRemaining == null) {
    const running = timer != null && RUNNING_STATUSES.has(timer.status);
    return { changed: false, reason: running ? "not-paused" : "not-running", row: timer };
  }

  const [row] = await casTimer(db, timer, {
    status: timer.pausedFromStatus ?? "work",
    targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
    pausedWithRemaining: null,
    pausedFromStatus: null,
  });
  return row ? { changed: true, row } : lostRace(db);
}

/** Dashboard shape of {@link resumeTimerWithResult} (see {@link pauseTimer}). */
export async function resumeTimer(db: DbClient) {
  return rowOrNull(await resumeTimerWithResult(db));
}

/**
 * Skip to the next phase; a paused timer skips from its pre-pause phase.
 * Overdue phases are advanced first, so skip always acts on the phase that is
 * actually current. `not-running` when there is nothing to skip (no timer, or
 * idle/finished).
 */
export async function skipTimerWithResult(
  db: DbClient,
  opts: TimerStatsOpts = {},
): Promise<TimerActionResult<SkipNoopReason>> {
  const [timer, timerConfigRow, timeZone] = await Promise.all([
    maybeAdvanceOverdueTimer(db, opts),
    db.query.timerConfig.findFirst(),
    resolveStatsTimeZone(db, opts.timeZone),
  ]);
  if (!timer) return { changed: false, reason: "not-running", row: null };

  const effectiveStatus =
    timer.status === "paused" ? (timer.pausedFromStatus ?? "work") : timer.status;

  const tc = getTimerConfig(timerConfigRow ?? null);
  const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
    { status: effectiveStatus, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
    tc,
  );

  // No-op guard: from idle/finished nothing changes — skip the DB write.
  if (nextStatus === timer.status && nextDuration === null && nextCycle === timer.currentCycle) {
    return { changed: false, reason: "not-running", row: timer };
  }

  // Guarded CAS on the state we read: if a concurrent action already moved
  // past this phase, our UPDATE matches no row — report the current state
  // instead of clobbering it (which would skip a second phase).
  // A skipped work phase still counts its worked minutes (never a pomodoro).
  const now = Date.now();
  const row = await casTimerWithCredits(
    db,
    timer,
    {
      status: nextStatus,
      currentCycle: nextCycle,
      pausedFromStatus: null,
      pausedWithRemaining: null,
      targetEndTime: nextDuration ? new Date(now + nextDuration) : null,
    },
    [{ at: now, focusMs: workedMs(timer, tc.workDuration, now), pomodoros: 0 }],
    timeZone,
  );
  return row ? { changed: true, row } : lostRace(db);
}

/**
 * Dashboard shape of {@link skipTimerWithResult}: null when there is nothing
 * to skip, the current row when a concurrent action won the race.
 */
export async function skipTimer(db: DbClient) {
  return rowOrNull(await skipTimerWithResult(db));
}

/** The legacy return contract: a row unless nothing could have happened. */
function rowOrNull(result: TimerActionResult<string>): TimerStateRow | null {
  return result.changed || result.reason === "lost-race" ? result.row : null;
}

/**
 * Reset the timer to idle. L4 fix: totalCycles comes from the configured
 * defaultCycles, never a hardcoded 4.
 *
 * Stats: overdue phases are advanced (and counted) first, then the reset is a
 * guarded CAS on the state that was read, so the worked minutes of a work phase
 * cut short are credited once even when two resets race. Should every attempt
 * lose, the reset still lands (unguarded, crediting nothing).
 */
export async function resetTimer(db: DbClient, opts: TimerStatsOpts = {}) {
  const [tc, , timeZone] = await Promise.all([
    loadTimerConfig(db),
    purgeExpiredDoneTasks(db),
    resolveStatsTimeZone(db, opts.timeZone),
  ]);
  const idle = {
    status: "idle" as const,
    targetEndTime: null,
    pausedWithRemaining: null,
    pausedFromStatus: null,
    currentCycle: 1,
    totalCycles: tc.defaultCycles,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const timer = await maybeAdvanceOverdueTimer(db, { timeZone });
    if (!timer) break;
    const now = Date.now();
    const row = await casTimerWithCredits(
      db,
      timer,
      idle,
      [{ at: now, focusMs: workedMs(timer, tc.workDuration, now), pomodoros: 0 }],
      timeZone,
    );
    if (row) return row;
  }
  return updateSingleton(db, schema.timerState, idle);
}

export interface TimerEta {
  /** End of the current phase (for a paused timer: if it resumed right now). */
  phaseEnd: Date;
  /** Projected end of the whole session (paused: if it resumed right now). */
  sessionEnd: Date;
  /** True when the timer is paused, so the remaining time is frozen. */
  paused: boolean;
}

/**
 * Projected end of the current phase + whole session, or null when there is
 * nothing to project (no timer, idle, finished). A paused timer projects from
 * its frozen remaining time and pre-pause phase.
 */
export async function getTimerEta(
  db: DbClient,
  opts: TimerStatsOpts = {},
): Promise<TimerEta | null> {
  const [timer, timerConfigRow] = await Promise.all([
    maybeAdvanceOverdueTimer(db, opts),
    db.query.timerConfig.findFirst(),
  ]);
  if (!timer) return null;

  const now = Date.now();
  const paused = timer.status === "paused" && timer.pausedWithRemaining != null;
  let phaseMs: number;
  let status: TimerStateRow["status"];
  if (paused) {
    phaseMs = timer.pausedWithRemaining ?? 0;
    status = timer.pausedFromStatus ?? "work";
  } else if (timer.targetEndTime) {
    phaseMs = timer.targetEndTime.getTime() - now;
    status = timer.status;
  } else {
    return null;
  }

  const tc = getTimerConfig(timerConfigRow ?? null);

  let totalMs = phaseMs;
  let cycle = timer.currentCycle;

  // Bounded so a pathological state can't spin, but sized to the session: each
  // cycle is at most two transitions (work → break → work), plus slack for a
  // leading "starting". A fixed cap of 100 stopped ~50 cycles in, so
  // `!timer start 99` reported roughly half the real session length.
  const maxSteps = 4 * timer.totalCycles + 4;
  let guard = 0;
  while (status !== "finished" && cycle <= timer.totalCycles && guard++ < maxSteps) {
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status, currentCycle: cycle, totalCycles: timer.totalCycles },
      tc,
    );
    if (nextDuration) totalMs += nextDuration;
    if (nextStatus === status && nextDuration === null) break;
    status = nextStatus;
    cycle = nextCycle;
  }

  return {
    phaseEnd: new Date(now + phaseMs),
    sessionEnd: new Date(now + totalMs),
    paused,
  };
}
