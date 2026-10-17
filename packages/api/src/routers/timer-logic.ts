// Pure Pomodoro state-machine logic (no db, no env), so it runs under Vitest in
// Node. Used by services/timer-service for skip and lazy overdue advancement.

import { TIMER_CONFIG_DEFAULTS, type TimerStatus } from "@dirework/db/defaults";

// Fallbacks when no timer_config row exists — same object that backs the
// schema column defaults (single source: packages/db/src/defaults.ts).
export const DEFAULTS = TIMER_CONFIG_DEFAULTS;

/** The timer_config fields the state machine needs; durations are in ms. */
export interface TimerConfigInput {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  startingDuration: number;
  noLastBreak: boolean;
  defaultCycles?: number;
}

/** Fill every missing field (or a missing row) from DEFAULTS. */
export function getTimerConfig(tc: TimerConfigInput | null) {
  return {
    workDuration: tc?.workDuration ?? DEFAULTS.workDuration,
    breakDuration: tc?.breakDuration ?? DEFAULTS.breakDuration,
    longBreakDuration: tc?.longBreakDuration ?? DEFAULTS.longBreakDuration,
    longBreakInterval: tc?.longBreakInterval ?? DEFAULTS.longBreakInterval,
    startingDuration: tc?.startingDuration ?? DEFAULTS.startingDuration,
    noLastBreak: tc?.noLastBreak ?? DEFAULTS.noLastBreak,
    defaultCycles: tc?.defaultCycles ?? DEFAULTS.defaultCycles,
  };
}

export interface PhaseInput {
  status: TimerStatus;
  currentCycle: number;
  totalCycles: number;
}

/** `nextDuration` is null when the next phase has no countdown (finished/unchanged). */
export interface PhaseResult {
  nextStatus: TimerStatus;
  nextDuration: number | null;
  nextCycle: number;
}

/**
 * Compute the next phase in the timer state machine.
 * Deduplicates the identical switch logic used by skip and the lazy
 * overdue-timer advancement.
 *
 * starting → work → (break | longBreak every `longBreakInterval` cycles) → work
 * of the next cycle, until `totalCycles`. The last work phase still takes its
 * break unless `noLastBreak`, then finishes. idle/paused/finished return their
 * own status unchanged.
 */
export function computeNextPhase(input: PhaseInput, config: TimerConfigInput): PhaseResult {
  let nextStatus: TimerStatus;
  let nextDuration: number | null = null;
  let nextCycle = input.currentCycle;

  switch (input.status) {
    case "starting":
      nextStatus = "work";
      nextDuration = config.workDuration;
      break;

    case "work":
      if (input.currentCycle >= input.totalCycles) {
        if (config.noLastBreak) {
          nextStatus = "finished";
        } else {
          nextStatus = input.currentCycle % config.longBreakInterval === 0 ? "longBreak" : "break";
          nextDuration =
            nextStatus === "longBreak" ? config.longBreakDuration : config.breakDuration;
        }
      } else {
        nextStatus = input.currentCycle % config.longBreakInterval === 0 ? "longBreak" : "break";
        nextDuration = nextStatus === "longBreak" ? config.longBreakDuration : config.breakDuration;
      }
      break;

    case "break":
    case "longBreak":
      nextCycle = input.currentCycle + 1;
      if (nextCycle > input.totalCycles) {
        nextStatus = "finished";
        // Clamp: never persist currentCycle past totalCycles ("5 of 4").
        nextCycle = input.totalCycles;
      } else {
        nextStatus = "work";
        nextDuration = config.workDuration;
      }
      break;

    default:
      nextStatus = input.status;
      break;
  }

  return { nextStatus, nextDuration, nextCycle };
}
