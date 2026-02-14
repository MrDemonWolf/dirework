// Default values matching Prisma @default() values for TimerConfig
export const DEFAULTS = {
  workDuration: 1500000,
  breakDuration: 300000,
  longBreakDuration: 900000,
  longBreakInterval: 4,
  startingDuration: 5000,
  noLastBreak: true,
};

export interface TimerConfigInput {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  startingDuration: number;
  noLastBreak: boolean;
}

export function getTimerConfig(tc: TimerConfigInput | null) {
  return {
    workDuration: tc?.workDuration ?? DEFAULTS.workDuration,
    breakDuration: tc?.breakDuration ?? DEFAULTS.breakDuration,
    longBreakDuration: tc?.longBreakDuration ?? DEFAULTS.longBreakDuration,
    longBreakInterval: tc?.longBreakInterval ?? DEFAULTS.longBreakInterval,
    startingDuration: tc?.startingDuration ?? DEFAULTS.startingDuration,
    noLastBreak: tc?.noLastBreak ?? DEFAULTS.noLastBreak,
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
 * Deduplicates the identical switch logic used by nextPhase and skip.
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
