import { TIMER_CONFIG_DEFAULTS } from "@dirework/db/defaults";

// Fallbacks when no timer_config row exists — same object that backs the
// schema column defaults (single source: packages/db/src/defaults.ts).
export const DEFAULTS = TIMER_CONFIG_DEFAULTS;

export interface TimerConfigInput {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  startingDuration: number;
  noLastBreak: boolean;
  defaultCycles?: number;
}

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
  status: string;
  currentCycle: number;
  totalCycles: number;
}

export interface PhaseResult {
  nextStatus: string;
  nextDuration: number | null;
  nextCycle: number;
}

/**
 * Compute the next phase in the timer state machine.
 * Deduplicates the identical switch logic used by skip and the lazy
 * overdue-timer advancement.
 */
export function computeNextPhase(
  input: PhaseInput,
  config: TimerConfigInput,
): PhaseResult {
  let nextStatus: string;
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
          nextStatus =
            input.currentCycle % config.longBreakInterval === 0
              ? "longBreak"
              : "break";
          nextDuration =
            nextStatus === "longBreak"
              ? config.longBreakDuration
              : config.breakDuration;
        }
      } else {
        nextStatus =
          input.currentCycle % config.longBreakInterval === 0
            ? "longBreak"
            : "break";
        nextDuration =
          nextStatus === "longBreak"
            ? config.longBreakDuration
            : config.breakDuration;
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
