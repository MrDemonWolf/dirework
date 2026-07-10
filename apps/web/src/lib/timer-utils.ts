// Shared overlay geometry + clock formatting live in @dirework/overlay-kit
// (also used by the docs-site overlay mocks). Re-exported here so web imports
// keep pointing at "@/lib/timer-utils".
export {
  SQUIRCLE_RADIUS,
  formatClock,
  roundedRectPath,
  roundedRectPerimeter,
} from "@dirework/overlay-kit";

/**
 * Timer state payload shape shared by the dashboard controls and the overlay
 * renderer (was declared separately in both — CodeRabbit follow-up).
 */
export interface TimerState {
  status: string;
  currentCycle: number;
  totalCycles: number;
  targetEndTime?: string | null;
  pausedWithRemaining?: number | null;
  pausedFromStatus?: string | null;
}

/**
 * Milliseconds left on the timer, computed from state alone (pure — no timers).
 * A paused timer reports its frozen remaining; a running timer measures
 * targetEndTime against now (clamped at 0). Returns null when there's nothing
 * to count (idle / no target). The live tick is driven by `useTimerCountdown`.
 */
export function remainingFromState(
  state: Pick<TimerState, "status" | "targetEndTime" | "pausedWithRemaining"> | null,
): number | null {
  if (!state) return null;
  if (state.status === "paused" && state.pausedWithRemaining != null) {
    return state.pausedWithRemaining;
  }
  if (!state.targetEndTime) return null;
  return Math.max(0, new Date(state.targetEndTime).getTime() - Date.now());
}

export function toHexOpacity(opacity: number): string {
  const clamped = Math.min(1, Math.max(0, opacity));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
}

export function formatTime(
  ms: number,
  showHours: boolean,
): { hours: string; minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(showHours ? minutes : Math.floor(totalSeconds / 60)).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

/** Configured phase lengths (ms) — shape matches the overlay timerConfig payload. */
export interface PhaseDurations {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  startingDuration: number;
}

/**
 * Resolve the full length (ms) of the phase the timer is measuring against.
 * A paused timer measures against the phase it froze in (pausedFromStatus).
 * Returns null for phases without a fixed duration (idle/finished/unknown).
 */
export function resolvePhaseDuration(
  status: string,
  pausedFromStatus: string | null | undefined,
  durations: PhaseDurations,
): number | null {
  const phase = status === "paused" ? (pausedFromStatus ?? "work") : status;
  switch (phase) {
    case "work":
      return durations.workDuration;
    case "break":
      return durations.breakDuration;
    case "longBreak":
      return durations.longBreakDuration;
    case "starting":
      return durations.startingDuration;
    default:
      return null;
  }
}
