// Pure calendar math behind the dashboard stats (no db, no env), so it runs under Vitest in
// Node and the services and the router share one definition of "a day" and "a week".
//
// A day is the owner's local calendar day as "YYYY-MM-DD" (the `daily_stat` primary key).
// Day strings sort like dates, so a range of days is a primary-key range read, and day
// arithmetic is done on the calendar (UTC midnight of that date), never on wall-clock time,
// so a DST change can never skip or repeat a day.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stats rows older than this many days are pruned (on timer start). */
export const STATS_RETENTION_DAYS = 400;

/** Weeks the summary looks back over: this week plus the four before it (≤ 35 rows). */
export const STATS_WINDOW_WEEKS = 5;

/** Daily buckets in the dashboard's focus chart, oldest first, ending today. */
export const STATS_CHART_DAYS = 14;

/** The longest IANA zone name is ~32 characters; anything longer is not one. */
export const MAX_TIME_ZONE_LENGTH = 64;

/** True when `timeZone` is an IANA zone this runtime's Intl knows. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > MAX_TIME_ZONE_LENGTH) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar day `ms` falls on in `timeZone` ("YYYY-MM-DD"). A missing or unknown zone
 * reads as UTC, so a stored zone the runtime stops recognising never fails a write.
 */
export function localDay(ms: number, timeZone: string | null | undefined): string {
  if (timeZone && isValidTimeZone(timeZone)) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(ms);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }
  return new Date(ms).toISOString().slice(0, 10);
}

/** `day` moved by `n` calendar days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday of `day`'s week (weeks run Monday to Sunday). */
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** First day the summary reads: the Monday four weeks before this week's. */
export function statsWindowStart(today: string): string {
  return addDays(weekStart(today), -7 * (STATS_WINDOW_WEEKS - 1));
}

/** Rows strictly before this day are past retention. */
export function retentionCutoff(nowMs: number): string {
  return localDay(nowMs - STATS_RETENTION_DAYS * DAY_MS, "UTC");
}

export interface DailyStatRow {
  day: string;
  focusMs: number;
  pomodoros: number;
  tasksDone: number;
  tasksDoneChat: number;
}

export interface StatsSummary {
  /** The owner's zone the days were computed in ("UTC" when none is set). */
  timeZone: string;
  today: DailyStatRow;
  /** Monday through today. `focusDays` = days with any focus time. */
  week: { focusMs: number; pomodoros: number; tasksDone: number; focusDays: number };
  /**
   * Consecutive weeks with at least one focus day, ending this week (or last week, while
   * this week has none yet — a streak is not broken until the week is over). `capped` means
   * the run reaches the start of the read window, so it is at least `weeks` long.
   */
  streak: { weeks: number; capped: boolean };
  /** STATS_CHART_DAYS buckets, oldest first, ending today. */
  days: { day: string; focusMs: number }[];
}

const emptyDay = (day: string): DailyStatRow => ({
  day,
  focusMs: 0,
  pomodoros: 0,
  tasksDone: 0,
  tasksDoneChat: 0,
});

/** Fold the window's rows (any order, missing days allowed) into the dashboard summary. */
export function summarizeStats(
  rows: readonly DailyStatRow[],
  today: string,
  timeZone: string,
): StatsSummary {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const at = (day: string) => byDay.get(day) ?? emptyDay(day);

  const thisWeek = weekStart(today);
  const week = { focusMs: 0, pomodoros: 0, tasksDone: 0, focusDays: 0 };
  for (let day = thisWeek; day <= today; day = addDays(day, 1)) {
    const row = at(day);
    week.focusMs += row.focusMs;
    week.pomodoros += row.pomodoros;
    week.tasksDone += row.tasksDone;
    if (row.focusMs > 0) week.focusDays += 1;
  }

  const weekHasFocus = (index: number) => {
    const start = addDays(thisWeek, -7 * index);
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      if (day > today) break;
      if (at(day).focusMs > 0) return true;
    }
    return false;
  };
  let index = week.focusDays > 0 ? 0 : 1;
  let weeks = 0;
  while (index < STATS_WINDOW_WEEKS && weekHasFocus(index)) {
    weeks += 1;
    index += 1;
  }
  const capped = weeks > 0 && index === STATS_WINDOW_WEEKS;

  const days = Array.from({ length: STATS_CHART_DAYS }, (_, i) => {
    const day = addDays(today, i - (STATS_CHART_DAYS - 1));
    return { day, focusMs: at(day).focusMs };
  });

  return { timeZone, today: at(today), week, streak: { weeks, capped }, days };
}
