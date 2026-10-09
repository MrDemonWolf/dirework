// ── Default config values (zod-free, schema-free) ───────────────────────────
// Kept out of config-shared so the OBS overlays and dashboard can import the
// defaults without bundling zod and the Drizzle schema. Re-exported by
// config-shared. Type-only imports are erased, so the cycle is safe.
import {
  DEFAULT_PHASE_LABELS as DB_DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES as DB_DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES as DB_DEFAULT_TIMER_MESSAGES,
  TIMER_CONFIG_DEFAULTS as DB_TIMER_CONFIG_DEFAULTS,
} from "@dirework/db/defaults";

import type { PhaseLabelsConfig, TaskMessagesConfig, TimerMessagesConfig } from "./config-shared";

/** Maximum task text length — enforced by tRPC input schemas AND the chat path. */
export const MAX_TASK_LEN = 500;

// Default values live in @dirework/db/defaults (the same objects back the
// schema column defaults); the typed re-exports below guarantee they stay in
// shape-lockstep with the field maps.

export const DEFAULT_PHASE_LABELS: PhaseLabelsConfig = DB_DEFAULT_PHASE_LABELS;
export const DEFAULT_TASK_MESSAGES: TaskMessagesConfig = DB_DEFAULT_TASK_MESSAGES;
export const DEFAULT_TIMER_MESSAGES: TimerMessagesConfig = DB_DEFAULT_TIMER_MESSAGES;

/** Canonical timer duration/cycle defaults — single source for the dashboard
 * controls, the overlay/preview progress fallbacks, and the schema columns. */
export const TIMER_CONFIG_DEFAULTS = DB_TIMER_CONFIG_DEFAULTS;
