// Pure presentation logic for the dashboard stats (tiles + 14-day focus chart), kept
// React-free so the copy, the bar geometry and the refresh rule are unit-tested.

import type { StatsSummary } from "@dirework/api/stats-days";

/** "0m", "25m", "1h 5m", "12h" — focus time as people say it. Whole minutes, rounded down. */
export function formatFocus(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Long form for screen readers and bar titles: "1 hour 5 minutes", "0 minutes". */
export function formatFocusLong(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (hours === 0) return unit(rest, "minute");
  return rest === 0 ? unit(hours, "hour") : `${unit(hours, "hour")} ${unit(rest, "minute")}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The chat share under "Tasks done today". */
export function chatShareLabel(done: number, fromChat: number): string {
  if (done === 0) return "None yet";
  if (fromChat === 0) return "All yours";
  if (fromChat === done) return "All from chat";
  return `${fromChat} from chat`;
}

/** The week streak under "This week": "3-week streak", "5+ week streak", or a nudge. */
export function streakLabel(streak: StatsSummary["streak"]): string {
  if (streak.weeks === 0) return "A focus day starts a streak";
  return streak.capped ? `${streak.weeks}+ week streak` : `${streak.weeks}-week streak`;
}

/** The four tiles under the greeting, in order. */
export function statTiles(summary: StatsSummary) {
  const { today, week } = summary;
  return [
    {
      id: "focus",
      label: "Focus today",
      value: formatFocus(today.focusMs),
      detail: `${formatFocus(week.focusMs)} this week`,
    },
    {
      id: "pomodoros",
      label: "Pomodoros today",
      value: String(today.pomodoros),
      detail: `${week.pomodoros} this week`,
    },
    {
      id: "tasks",
      label: "Tasks done today",
      value: String(today.tasksDone),
      detail: chatShareLabel(today.tasksDone, today.tasksDoneChat),
    },
    {
      id: "week",
      label: "This week",
      value: plural(week.focusDays, "day"),
      detail: streakLabel(summary.streak),
    },
  ] as const;
}

/**
 * Layout classes of the stats strip's cell `index`, shared by `StatTiles` and its
 * placeholder so they stay box for box: the hairlines form a cross on a phone (2×2) and
 * column rules from lg (one row).
 */
export function statCellClass(index: number): string {
  return [
    "flex min-w-0 flex-col gap-1 px-5 py-4",
    index % 2 === 1 ? "border-l border-border/60" : "",
    index >= 2 ? "border-t border-border/60 lg:border-t-0" : "",
    index === 2 ? "lg:border-l" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Chart geometry, in SVG user units (the SVG scales to its column). */
export const CHART = { width: 280, height: 56, barWidth: 12, radius: 4, minBar: 2 } as const;

/** A day as "Mon, Oct 26" (the day string is a calendar date, so it is formatted in UTC). */
export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * One bar per day, oldest first: a column with a 4px rounded top, square at the baseline.
 * Heights scale to the busiest day; a day with no focus keeps a 2px stub on the baseline
 * so it reads as zero, not missing. The last day is today.
 */
export function chartBars(days: StatsSummary["days"]) {
  const max = Math.max(0, ...days.map((d) => d.focusMs));
  const slot = CHART.width / Math.max(1, days.length);
  return days.map((d, i) => {
    const height =
      max > 0 && d.focusMs > 0
        ? Math.max(CHART.radius + 1, (d.focusMs / max) * CHART.height)
        : CHART.minBar;
    const x = i * slot + (slot - CHART.barWidth) / 2;
    const y = CHART.height - height;
    const r = height > CHART.radius ? CHART.radius : 0;
    const right = x + CHART.barWidth;
    const path =
      r > 0
        ? `M${x},${CHART.height}V${y + r}Q${x},${y} ${x + r},${y}H${right - r}Q${right},${y} ${right},${y + r}V${CHART.height}Z`
        : `M${x},${CHART.height}V${y}H${right}V${CHART.height}Z`;
    return {
      day: d.day,
      focusMs: d.focusMs,
      today: i === days.length - 1,
      path,
      // The hover target is the whole slot, taller than the bar.
      hit: { x: i * slot, width: slot },
      title: `${formatDay(d.day)}: ${formatFocusLong(d.focusMs)} of focus`,
    };
  });
}

/** The values that decide whether the stats may have changed: timer status, done-task count. */
export interface StatsWatch {
  timerStatus?: string;
  doneCount?: number;
}

/**
 * Refetch the summary when the dashboard's existing polls see something stats depend on:
 * the timer changing phase (a work phase ended, was skipped, or was reset) or the done-task
 * count rising (a task finished, from the dashboard or chat). The first value seen for
 * either only records it.
 */
export function shouldRefreshStats(prev: StatsWatch, next: StatsWatch): boolean {
  const statusChanged =
    prev.timerStatus !== undefined &&
    next.timerStatus !== undefined &&
    prev.timerStatus !== next.timerStatus;
  const doneRose =
    prev.doneCount !== undefined && next.doneCount !== undefined && next.doneCount > prev.doneCount;
  return statusChanged || doneRose;
}

/** The browser's IANA zone, or null where Intl can't say. */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
