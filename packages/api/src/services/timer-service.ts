import { and, eq, isNull } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { SINGLETON_ID } from "@dirework/db/schema";

import type { TimerStatus } from "../config-shared";
import { computeNextPhase, getTimerConfig } from "../routers/timer-logic";
import { updateSingleton } from "./singleton";
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
 */
export async function maybeAdvanceOverdueTimer(db: DbClient): Promise<TimerStateRow | null> {
  let timer = (await db.query.timerState.findFirst()) ?? null;
  let timerConfigRow: typeof schema.timerConfig.$inferSelect | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!timer || !isOverdue(timer)) return timer;

    timerConfigRow ??= (await db.query.timerConfig.findFirst()) ?? null;
    const next = catchUpOverdue(timer, getTimerConfig(timerConfigRow), Date.now());

    const [row] = await casTimer(db, timer, {
      ...next,
      pausedFromStatus: null,
      pausedWithRemaining: null,
    });

    // Guarded update lost (another poller advanced first) → re-read and retry.
    timer = row ?? (await db.query.timerState.findFirst()) ?? null;
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
 * session is well under the guard.
 */
export function catchUpOverdue(
  timer: Pick<TimerStateRow, "status" | "currentCycle" | "totalCycles"> & { targetEndTime: Date },
  tc: ReturnType<typeof getTimerConfig>,
  now: number,
): Pick<TimerStateRow, "status" | "currentCycle" | "targetEndTime"> {
  let status = timer.status;
  let currentCycle = timer.currentCycle;
  let targetEndTime: Date | null = timer.targetEndTime;

  for (let i = 0; i < 1000 && targetEndTime && targetEndTime.getTime() <= now; i++) {
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status, currentCycle, totalCycles: timer.totalCycles },
      tc,
    );
    status = nextStatus;
    currentCycle = nextCycle;
    targetEndTime = nextDuration ? new Date(targetEndTime.getTime() + nextDuration) : null;
  }
  return { status, currentCycle, targetEndTime };
}

export async function getTimerState(db: DbClient): Promise<TimerStateRow | null> {
  return maybeAdvanceOverdueTimer(db);
}

async function loadTimerConfig(db: DbClient) {
  const timerConfigRow = await db.query.timerConfig.findFirst();
  return getTimerConfig(timerConfigRow ?? null);
}

/** Start (or restart) the timer in the "starting" phase. */
export async function startTimer(db: DbClient, opts?: { totalCycles?: number }) {
  // A session boundary is a natural moment for the done-task retention purge.
  const [tc] = await Promise.all([loadTimerConfig(db), purgeExpiredDoneTasks(db)]);

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

/** Pause a running timer, storing the remaining milliseconds. */
export async function pauseTimer(db: DbClient) {
  const timer = await getTimerState(db);
  if (!timer?.targetEndTime) return null;

  const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());

  const [row] = await casTimer(db, timer, {
    status: "paused",
    pausedFromStatus: timer.status,
    pausedWithRemaining: remaining,
    targetEndTime: null,
  });
  return row ?? (await db.query.timerState.findFirst()) ?? null;
}

/**
 * Resume a paused timer. M2 fix: nullish check — a timer paused with exactly
 * 0ms remaining must still resume (the old falsy check left it stuck forever).
 */
export async function resumeTimer(db: DbClient) {
  const timer = await getTimerState(db);
  if (timer?.pausedWithRemaining == null) return null;

  const [row] = await casTimer(db, timer, {
    status: timer.pausedFromStatus ?? "work",
    targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
    pausedWithRemaining: null,
    pausedFromStatus: null,
  });
  return row ?? (await db.query.timerState.findFirst()) ?? null;
}

/**
 * Skip to the next phase; a paused timer skips from its pre-pause phase.
 * Overdue phases are advanced first, so skip always acts on the phase that is
 * actually current. Returns null when there is nothing to skip (no timer, or
 * idle/finished).
 */
export async function skipTimer(db: DbClient) {
  const [timer, timerConfigRow] = await Promise.all([
    maybeAdvanceOverdueTimer(db),
    db.query.timerConfig.findFirst(),
  ]);
  if (!timer) return null;

  const effectiveStatus =
    timer.status === "paused" ? (timer.pausedFromStatus ?? "work") : timer.status;

  const tc = getTimerConfig(timerConfigRow ?? null);
  const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
    { status: effectiveStatus, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
    tc,
  );

  // No-op guard: from idle/finished nothing changes — skip the DB write.
  if (nextStatus === timer.status && nextDuration === null && nextCycle === timer.currentCycle) {
    return null;
  }

  // Guarded CAS on the state we read: if a concurrent action already moved
  // past this phase, our UPDATE matches no row — return the current state
  // instead of clobbering it (which would skip a second phase).
  const [row] = await casTimer(db, timer, {
    status: nextStatus,
    currentCycle: nextCycle,
    pausedFromStatus: null,
    pausedWithRemaining: null,
    targetEndTime: nextDuration ? new Date(Date.now() + nextDuration) : null,
  });
  return row ?? (await db.query.timerState.findFirst()) ?? null;
}

/**
 * Reset the timer to idle. L4 fix: totalCycles comes from the configured
 * defaultCycles, never a hardcoded 4.
 */
export async function resetTimer(db: DbClient) {
  const [tc] = await Promise.all([loadTimerConfig(db), purgeExpiredDoneTasks(db)]);

  return updateSingleton(db, schema.timerState, {
    status: "idle",
    targetEndTime: null,
    pausedWithRemaining: null,
    pausedFromStatus: null,
    currentCycle: 1,
    totalCycles: tc.defaultCycles,
  });
}

export interface TimerEta {
  /** End of the current phase. */
  phaseEnd: Date;
  /** Projected end of the whole session. */
  sessionEnd: Date;
}

/** Projected end of the current phase + whole session, or null if not running. */
export async function getTimerEta(db: DbClient): Promise<TimerEta | null> {
  const [timer, timerConfigRow] = await Promise.all([
    maybeAdvanceOverdueTimer(db),
    db.query.timerConfig.findFirst(),
  ]);
  if (!timer?.targetEndTime) return null;

  const tc = getTimerConfig(timerConfigRow ?? null);

  let totalMs = timer.targetEndTime.getTime() - Date.now();
  let cycle = timer.currentCycle;
  let status = timer.status;

  // Bounded like maybeAdvanceOverdueTimer — a pathological config can't spin.
  let guard = 0;
  while (status !== "finished" && cycle <= timer.totalCycles && guard++ < 100) {
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
    phaseEnd: timer.targetEndTime,
    sessionEnd: new Date(Date.now() + totalMs),
  };
}
