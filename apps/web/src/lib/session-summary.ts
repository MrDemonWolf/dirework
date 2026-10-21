// One-line summary of the saved Pomodoro session, shown on the dashboard's collapsed
// "Edit session settings" disclosure. Pure so it is unit-tested without React.

import { TIMER_CONFIG_DEFAULTS } from "@/lib/config-types";

/** The saved timer-config fields the summary reads (durations in ms). */
export interface SessionSummaryConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
}

/** Whole minutes for a ms duration; never below 1, so a sub-minute value doesn't read 0m. */
function minutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

/**
 * `FOCUS 25m · BREAK 5m · LONG 15m · EVERY 4`. Missing config (still loading, or a
 * failed fetch) and missing fields fall back to `TIMER_CONFIG_DEFAULTS`, the values a
 * fresh instance starts with.
 */
export function formatSessionSummary(config?: Partial<SessionSummaryConfig> | null): string {
  const c = { ...TIMER_CONFIG_DEFAULTS, ...config };
  return [
    `FOCUS ${minutes(c.workDuration)}m`,
    `BREAK ${minutes(c.breakDuration)}m`,
    `LONG ${minutes(c.longBreakDuration)}m`,
    `EVERY ${c.longBreakInterval}`,
  ].join(" · ");
}
