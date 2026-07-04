import { and, eq } from "drizzle-orm";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { SINGLETON_ID } from "../config-shared";
import { computeNextPhase, getTimerConfig } from "../routers/timer-logic";

// Single implementation of the timer state machine mutations (audit M1) —
// called by both the tRPC timer router and the bot ingest path.

export type TimerStateRow = typeof schema.timerState.$inferSelect;

const RUNNING_STATUSES = new Set(["starting", "work", "break", "longBreak"]);

/**
 * Lazily advance a timer whose targetEndTime has passed. There is no always-on
 * server on Workers, so phase transitions are driven by reads: every overlay
 * poll, dashboard query, or chat command self-heals the state machine. Each new
 * phase is anchored at the PREVIOUS phase's end time (not Date.now()), so a
 * timer left unattended catches up through multiple missed phases accurately.
 * Concurrent pollers race safely: the UPDATE is guarded on the old
 * targetEndTime, and a loser just re-reads.
 */
export async function maybeAdvanceOverdueTimer(db: DbClient): Promise<TimerStateRow | null> {
  let timer = (await db.query.timerState.findFirst()) ?? null;
  let timerConfigRow: typeof schema.timerConfig.$inferSelect | null = null;

  for (let i = 0; i < 50; i++) {
    if (
      !timer ||
      !RUNNING_STATUSES.has(timer.status) ||
      !timer.targetEndTime ||
      timer.targetEndTime.getTime() > Date.now()
    ) {
      return timer;
    }

    timerConfigRow ??= (await db.query.timerConfig.findFirst()) ?? null;
    const tc = getTimerConfig(timerConfigRow);
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status: timer.status, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
      tc,
    );

    const prevEnd = timer.targetEndTime;
    const [row] = await db.update(schema.timerState)
      .set({
        status: nextStatus,
        currentCycle: nextCycle,
        pausedFromStatus: null,
        pausedWithRemaining: null,
        targetEndTime: nextDuration ? new Date(prevEnd.getTime() + nextDuration) : null,
      })
      .where(and(
        eq(schema.timerState.id, SINGLETON_ID),
        eq(schema.timerState.targetEndTime, prevEnd),
      ))
      .returning();

    // Guarded update lost (another poller advanced first) → re-read and retry.
    timer = row ?? (await db.query.timerState.findFirst()) ?? null;
  }
  return timer;
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
  const tc = await loadTimerConfig(db);

  const values = {
    status: "starting",
    targetEndTime: new Date(Date.now() + tc.startingDuration),
    pausedWithRemaining: null,
    pausedFromStatus: null,
    currentCycle: 1,
    totalCycles: opts?.totalCycles ?? tc.defaultCycles,
  };

  const [row] = await db.insert(schema.timerState)
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

  const [row] = await db.update(schema.timerState)
    .set({
      status: "paused",
      pausedFromStatus: timer.status,
      pausedWithRemaining: remaining,
      targetEndTime: null,
    })
    .where(eq(schema.timerState.id, SINGLETON_ID))
    .returning();
  return row ?? null;
}

/**
 * Resume a paused timer. M2 fix: nullish check — a timer paused with exactly
 * 0ms remaining must still resume (the old falsy check left it stuck forever).
 */
export async function resumeTimer(db: DbClient) {
  const timer = await getTimerState(db);
  if (timer?.pausedWithRemaining == null) return null;

  const [row] = await db.update(schema.timerState)
    .set({
      status: timer.pausedFromStatus ?? "work",
      targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
      pausedWithRemaining: null,
      pausedFromStatus: null,
    })
    .where(eq(schema.timerState.id, SINGLETON_ID))
    .returning();
  return row ?? null;
}

async function advanceTimer(db: DbClient, resolvePaused: boolean) {
  const [timer, timerConfigRow] = await Promise.all([
    db.query.timerState.findFirst(),
    db.query.timerConfig.findFirst(),
  ]);
  if (!timer) return null;

  const effectiveStatus = resolvePaused && timer.status === "paused"
    ? (timer.pausedFromStatus ?? "work")
    : timer.status;

  const tc = getTimerConfig(timerConfigRow ?? null);
  const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
    { status: effectiveStatus, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
    tc,
  );

  // No-op guard (L6): from idle/finished nothing changes — skip the DB write.
  if (nextStatus === timer.status && nextDuration === null && nextCycle === timer.currentCycle) {
    return timer;
  }

  const [row] = await db.update(schema.timerState)
    .set({
      status: nextStatus,
      currentCycle: nextCycle,
      pausedFromStatus: null,
      pausedWithRemaining: null,
      targetEndTime: nextDuration ? new Date(Date.now() + nextDuration) : null,
    })
    .where(eq(schema.timerState.id, SINGLETON_ID))
    .returning();
  return row ?? null;
}

/** Advance from the current phase (does not resolve a paused phase). */
export async function nextPhase(db: DbClient) {
  return advanceTimer(db, false);
}

/** Skip to the next phase; a paused timer skips from its pre-pause phase. */
export async function skipTimer(db: DbClient) {
  return advanceTimer(db, true);
}

/** Force a specific phase (dashboard escape hatch). */
export async function transitionTimer(
  db: DbClient,
  status: string,
  durationMs?: number,
) {
  const data: Partial<typeof schema.timerState.$inferInsert> = { status };

  if (durationMs) {
    data.targetEndTime = new Date(Date.now() + durationMs);
    data.pausedWithRemaining = null;
  }

  if (status === "idle" || status === "finished") {
    data.targetEndTime = null;
    data.pausedWithRemaining = null;
  }

  const [row] = await db.update(schema.timerState)
    .set(data)
    .where(eq(schema.timerState.id, SINGLETON_ID))
    .returning();
  return row ?? null;
}

/**
 * Reset the timer to idle. L4 fix: totalCycles comes from the configured
 * defaultCycles, never a hardcoded 4.
 */
export async function resetTimer(db: DbClient) {
  const tc = await loadTimerConfig(db);

  const [row] = await db.update(schema.timerState)
    .set({
      status: "idle",
      targetEndTime: null,
      pausedWithRemaining: null,
      pausedFromStatus: null,
      currentCycle: 1,
      totalCycles: tc.defaultCycles,
    })
    .where(eq(schema.timerState.id, SINGLETON_ID))
    .returning();
  return row ?? null;
}

/** Projected end time of the whole session, or null if not running. */
export async function getTimerEta(db: DbClient): Promise<Date | null> {
  const [timer, timerConfigRow] = await Promise.all([
    maybeAdvanceOverdueTimer(db),
    db.query.timerConfig.findFirst(),
  ]);
  if (!timer?.targetEndTime) return null;

  const tc = getTimerConfig(timerConfigRow ?? null);

  let totalMs = timer.targetEndTime.getTime() - Date.now();
  let cycle = timer.currentCycle;
  let status = timer.status;

  while (status !== "finished" && cycle <= timer.totalCycles) {
    const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
      { status, currentCycle: cycle, totalCycles: timer.totalCycles },
      tc,
    );
    if (nextDuration) totalMs += nextDuration;
    if (nextStatus === status && nextDuration === null) break;
    status = nextStatus;
    cycle = nextCycle;
  }

  return new Date(Date.now() + totalMs);
}
