// ── Default config values (zod-free, schema-free) ───────────────────────────
// Kept out of config-shared so the OBS overlays and dashboard can import the
// defaults (and the tRPC batch cap every client link needs) without bundling zod
// and the Drizzle schema. Re-exported by config-shared. Type-only imports are
// erased, so the cycle is safe.
import {
  DEFAULT_PHASE_LABELS as DB_DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES as DB_DEFAULT_TASK_MESSAGES,
  DEFAULT_TASK_STYLES as DB_DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_MESSAGES as DB_DEFAULT_TIMER_MESSAGES,
  DEFAULT_TIMER_STYLES as DB_DEFAULT_TIMER_STYLES,
  TIMER_CONFIG_DEFAULTS as DB_TIMER_CONFIG_DEFAULTS,
} from "@dirework/db/defaults";

import type {
  PhaseLabelsConfig,
  TaskMessagesConfig,
  TaskStylesConfig,
  TimerMessagesConfig,
  TimerStylesConfig,
} from "./config-shared";

/**
 * Max procedures in one tRPC batch request. The rate limiter charges a whole
 * request once, so an unbounded batch would let one request run hundreds of
 * procedures. The server rejects larger batches; client links split at it.
 */
export const TRPC_MAX_BATCH_SIZE = 10;

/** Maximum task text length — enforced by tRPC input schemas AND the chat path. */
export const MAX_TASK_LEN = 500;

/**
 * How many tasks one author may hold `started` (in progress but parked) beside
 * their single focus (`active`). Enforced inside the guarded UPDATEs in
 * task-service, so concurrent starts can't exceed it.
 */
export const MAX_STARTED_PER_AUTHOR = 2;

/**
 * Most open (pending, started or active) tasks the whole instance holds, across
 * every author. Every task-creating path (dashboard create, chat !task / !next,
 * the dashboard's undo) checks it inside its guarded INSERT, so concurrent
 * creates can't exceed it, and the overlay/dashboard list reads cap their open
 * slice at it, so a poll never reads an unbounded number of rows. The
 * per-viewer chat cap (CHAT_OPEN_TASK_CAP) still applies underneath it.
 */
export const MAX_OPEN_TASKS = 200;

// Default values live in @dirework/db/defaults (the same objects back the
// schema column defaults); the typed re-exports below guarantee they stay in
// shape-lockstep with the field maps.

export const DEFAULT_PHASE_LABELS: PhaseLabelsConfig = DB_DEFAULT_PHASE_LABELS;
export const DEFAULT_TASK_MESSAGES: TaskMessagesConfig = DB_DEFAULT_TASK_MESSAGES;
export const DEFAULT_TIMER_MESSAGES: TimerMessagesConfig = DB_DEFAULT_TIMER_MESSAGES;

/** Overlay styles a never-customized instance renders (also the "Default" preset).
 * Treat as read-only: clone before mutating. */
export const DEFAULT_TIMER_STYLES: TimerStylesConfig = DB_DEFAULT_TIMER_STYLES;
export const DEFAULT_TASK_STYLES: TaskStylesConfig = DB_DEFAULT_TASK_STYLES;

/** Canonical timer duration/cycle defaults — single source for the dashboard
 * controls, the overlay/preview progress fallbacks, and the schema columns. */
export const TIMER_CONFIG_DEFAULTS = DB_TIMER_CONFIG_DEFAULTS;

/**
 * The dashboard's "Edit session settings" ranges: durations in whole minutes
 * (`unit: "min"`), the rest plain counts. They are the editor's own and tighter
 * than `updateTimerConfigInput` (1s to 24h per phase, 1–99 counts), which stays
 * the authority; a test holds every bound inside that schema. TimerSettings
 * reads these for its inputs' min/max and its blur clamp.
 */
export const TIMER_FIELD_LIMITS = {
  workDuration: { min: 1, max: 120, unit: "min" },
  breakDuration: { min: 1, max: 60, unit: "min" },
  longBreakDuration: { min: 1, max: 60, unit: "min" },
  longBreakInterval: { min: 2, max: 20, unit: "count" },
  defaultCycles: { min: 1, max: 99, unit: "count" },
} as const satisfies Partial<
  Record<keyof typeof DB_TIMER_CONFIG_DEFAULTS, { min: number; max: number; unit: "min" | "count" }>
>;

/**
 * The task overlay's "Lines per task" range. Long task text wraps (there is no
 * length cap beyond MAX_TASK_LEN) and is cut with an ellipsis after this many
 * lines. The save schema takes only this range; a row saved under the old 1–100
 * range is clamped on read (`nestTaskStyleRow`) and again at render.
 */
export const TASK_LINES_MIN = 1;
export const TASK_LINES_MAX = 6;

/** `numberOfLines` held to TASK_LINES_MIN..TASK_LINES_MAX (a non-finite value reads as the default). */
export function clampTaskLines(lines: number): number {
  if (!Number.isFinite(lines)) return DEFAULT_TASK_STYLES.display.numberOfLines;
  return Math.min(TASK_LINES_MAX, Math.max(TASK_LINES_MIN, Math.round(lines)));
}
