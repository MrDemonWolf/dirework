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

/**
 * The label a task row shows at its end on the overlay: "Active" for the
 * author's focus task (which also gets the ACTIVE_ROW_TINT_PERCENT tint),
 * "Started" for a parked `started` task (label only, no tint), none otherwise.
 * Both are set in the username color at the same size.
 */
export function taskStatusLabel(status: string): "Active" | "Started" | null {
  if (status === "active") return "Active";
  if (status === "started") return "Started";
  return null;
}

/**
 * Floor (px) for the "Active" and "Started" labels, which are otherwise 0.55× the task font size
 * (13.2px at the default 24px). Measured at the overlay's own source size
 * (700×800 for tasks), before OBS scales the source.
 */
export const ACTIVE_LABEL_MIN_PX = 14;

/** Opacity of the "+N more" footer a non-scrolling task list shows when rows are cut off. */
export const MORE_FOOTER_OPACITY = 0.8;

/** Vertical gap (px) between task rows inside an author group. */
export const TASK_ROW_GAP_PX = 2;

/** One author group of a non-scrolling list, measured from the top of the list area. */
export interface ListGroupBox {
  /** The group card's bottom edge. */
  bottom: number;
  /** Each task row's bottom edge, in list order. */
  rowBottoms: readonly number[];
}

export interface StaticListFit {
  /** Rows the "+N more" footer reports. */
  hidden: number;
  /**
   * Per group: how many of its rows show, and how far to clip the card up from
   * its bottom edge so it ends at its last shown row (0 when every row or no row
   * shows). A group with no row showing is hidden whole, header included.
   */
  groups: { visibleRows: number; clipBottom: number }[];
}

/**
 * Which rows a non-scrolling task list shows. Whole rows only: a row shows when
 * it fits entirely, and once one doesn't, every later row is hidden too (so the
 * list never skips a long row to show a short one after it). If every row fits
 * the whole area, nothing is hidden and no footer shows. Otherwise the footer is
 * overlaid on the bottom of the area and rows must end above it; the area itself
 * never shrinks for the footer, so the result can return to "all shown".
 */
export function fitStaticList(
  groups: readonly ListGroupBox[],
  areaHeight: number,
  footerHeight: number,
): StaticListFit {
  const fitsWhole = groups.every((g) => g.rowBottoms.every((bottom) => bottom <= areaHeight));
  const limit = fitsWhole ? areaHeight : areaHeight - footerHeight;
  let hidden = 0;
  let open = true;
  const fit = groups.map((group) => {
    let visibleRows = 0;
    for (const bottom of group.rowBottoms) {
      if (open && bottom <= limit) visibleRows++;
      else {
        open = false;
        hidden++;
      }
    }
    const cut = visibleRows > 0 && visibleRows < group.rowBottoms.length;
    const lastShown = group.rowBottoms[visibleRows - 1] ?? group.bottom;
    return { visibleRows, clipBottom: cut ? Math.max(0, group.bottom - lastShown) : 0 };
  });
  return { hidden, groups: fit };
}

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
