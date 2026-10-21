import {
  DEFAULT_PHASE_LABELS,
  type PhaseLabelsConfig,
  type TaskStylesConfig,
  type TimerStylesConfig,
} from "@/lib/config-types";
import { defaultTaskStyles, defaultTimerStyles } from "@/lib/theme-presets";
import { type PhaseDurations, type TimerState, resolvePhaseDuration } from "@/lib/timer-utils";

// What the OBS overlay pages render for a poll payload. `null` from these means
// "render nothing" (a transparent source): the first poll hasn't landed or
// failed, or the server answered null because the token in the URL is invalid
// or was reset. A stale URL must go blank rather than show a fake 00:00 timer
// or an empty task list. React Query keeps the last good payload across failed
// refetches, so a transient error never reaches here as `undefined`.

/**
 * Strength (%) of the author-color tint behind each author header on the task
 * overlay. Shared with the preset contrast test, which composites it under the
 * username — so a tint change re-checks every preset.
 */
export const AUTHOR_HEADER_TINT_PERCENT = 6;

/**
 * The `{done}/{total}` counters are de-emphasized with opacity. They are still
 * viewer-facing text, so theme-contrast.test.ts composites these values and
 * holds them to the same 4.5:1 bar as the rest of the overlay.
 */
export const AUTHOR_COUNT_OPACITY = 0.8;
export const HEADER_COUNT_OPACITY = 0.8;

/** The timer's `{n}/{total}` cycle line is faded with this opacity (contrast-tested). */
export const TIMER_CYCLE_OPACITY = 0.8;

/**
 * The active task row is a static tint of the username color at this strength
 * (no glow, no pulse), plus an "Active" label in that color. The contrast test
 * measures the label against this tint over the author group.
 */
export const ACTIVE_ROW_TINT_PERCENT = 10;

/** Opacity of the "+N more" footer a non-scrolling task list shows when rows are cut off. */
export const MORE_FOOTER_OPACITY = 0.8;

/** Vertical gap (px) between task rows inside an author group. */
export const TASK_ROW_GAP_PX = 2;

/**
 * Path of an OBS overlay page for a token, or null while the token is missing
 * (not loaded yet, or `user.me` found no instance row). Null keeps
 * `SecretUrlRow` masked and disabled; interpolating the token directly would
 * offer a copyable `/overlay/t/null`.
 */
export function overlayPath(kind: "timer" | "tasks", token: string | null | undefined) {
  if (!token) return null;
  return `/overlay/${kind === "timer" ? "t" : "l"}/${token}`;
}

/** A valid instance whose timer has never run (no state row yet). */
const IDLE_TIMER_STATE: TimerState = {
  status: "idle",
  targetEndTime: null,
  pausedWithRemaining: null,
  pausedFromStatus: null,
  currentCycle: 1,
  totalCycles: 4,
};

export interface TimerOverlayPayload {
  /** Serialized timer_state row (targetEndTime arrives as a string). */
  timerState: unknown;
  timerStyles: TimerStylesConfig | null;
  timerConfig: (PhaseDurations & { labels: PhaseLabelsConfig; showHours: boolean }) | null;
}

export function timerOverlayView(payload: TimerOverlayPayload | null | undefined) {
  if (!payload) return null;

  const state = (payload.timerState as TimerState | null) ?? IDLE_TIMER_STATE;
  const { timerConfig } = payload;
  const config = {
    ...(payload.timerStyles ?? defaultTimerStyles),
    labels: timerConfig?.labels ?? DEFAULT_PHASE_LABELS,
    showHours: timerConfig?.showHours ?? false,
  };

  // Ring progress measures remaining against the streamer's configured phase
  // length (paused phases measure against the phase they froze in). Without a
  // config row TimerDisplay falls back to its built-in defaults. Idle has no
  // phase of its own — show the work length so the setup preview reads full.
  const totalDuration = timerConfig
    ? (resolvePhaseDuration(state.status, state.pausedFromStatus, timerConfig) ??
      (state.status === "idle" ? timerConfig.workDuration : undefined))
    : undefined;

  return { config, state, totalDuration };
}

export interface TaskOverlayPayload<TTask, TCounts> {
  tasks: TTask[];
  counts: TCounts;
  taskStyles: TaskStylesConfig | null;
}

export function taskOverlayView<TTask, TCounts>(
  payload: TaskOverlayPayload<TTask, TCounts> | null | undefined,
) {
  if (!payload) return null;
  return {
    config: payload.taskStyles ?? defaultTaskStyles,
    tasks: payload.tasks,
    counts: payload.counts,
  };
}
