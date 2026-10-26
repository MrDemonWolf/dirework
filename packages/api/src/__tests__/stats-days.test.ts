import { describe, expect, it } from "vitest";

import {
  STATS_CHART_DAYS,
  addDays,
  isValidTimeZone,
  localDay,
  retentionCutoff,
  statsWindowStart,
  summarizeStats,
  weekStart,
  type DailyStatRow,
} from "../stats-days";

const row = (day: string, focusMin: number, extra: Partial<DailyStatRow> = {}): DailyStatRow => ({
  day,
  focusMs: focusMin * 60_000,
  pomodoros: 0,
  tasksDone: 0,
  tasksDoneChat: 0,
  ...extra,
});

describe("localDay", () => {
  // 2026-03-08 07:30 UTC: 01:30 CST in Chicago, 30 minutes before the spring-forward jump.
  const instant = Date.UTC(2026, 2, 8, 7, 30);

  it("formats the calendar day in the owner's zone", () => {
    expect(localDay(instant, "America/Chicago")).toBe("2026-03-08");
    expect(localDay(Date.UTC(2026, 2, 8, 5, 59), "America/Chicago")).toBe("2026-03-07");
    expect(localDay(Date.UTC(2026, 2, 8, 15, 0), "Asia/Tokyo")).toBe("2026-03-09");
  });

  it("falls back to UTC for a missing or unknown zone", () => {
    expect(localDay(Date.UTC(2026, 2, 8, 23, 59), null)).toBe("2026-03-08");
    expect(localDay(Date.UTC(2026, 2, 8, 23, 59), "Not/AZone")).toBe("2026-03-08");
  });

  it("validates zones", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone(`Europe/${"x".repeat(80)}`)).toBe(false);
  });
});

describe("calendar arithmetic", () => {
  it("moves across month, year and DST boundaries one calendar day at a time", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", -1)).toBe("2026-03-07");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("starts weeks on Monday", () => {
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
    expect(weekStart("2026-10-28")).toBe("2026-10-26");
  });

  it("reads this week plus four before it, at most 35 days", () => {
    expect(statsWindowStart("2026-11-01")).toBe("2026-09-28");
    expect(statsWindowStart("2026-10-26")).toBe("2026-09-28");
  });

  it("cuts retention 400 days back", () => {
    expect(retentionCutoff(Date.UTC(2026, 9, 26, 12))).toBe("2025-09-21");
  });
});

describe("summarizeStats", () => {
  const today = "2026-10-28"; // Wednesday

  it("returns zeros and 14 empty buckets with no rows", () => {
    const summary = summarizeStats([], today, "UTC");
    expect(summary.today).toEqual(row(today, 0));
    expect(summary.week).toEqual({ focusMs: 0, pomodoros: 0, tasksDone: 0, focusDays: 0 });
    expect(summary.streak).toEqual({ weeks: 0, capped: false });
    expect(summary.days).toHaveLength(STATS_CHART_DAYS);
    expect(summary.days[0]?.day).toBe("2026-10-15");
    expect(summary.days.at(-1)).toEqual({ day: today, focusMs: 0 });
  });

  it("sums this week (Monday to today) and counts its focus days", () => {
    const summary = summarizeStats(
      [
        row("2026-10-25", 99), // last Sunday: not this week
        row("2026-10-26", 50, { pomodoros: 2, tasksDone: 3 }),
        row("2026-10-27", 0, { tasksDone: 1 }), // a day with tasks but no focus
        row(today, 25, { pomodoros: 1, tasksDone: 2, tasksDoneChat: 1 }),
      ],
      today,
      "UTC",
    );
    expect(summary.week).toEqual({
      focusMs: 75 * 60_000,
      pomodoros: 3,
      tasksDone: 6,
      focusDays: 2,
    });
    expect(summary.today).toMatchObject({ tasksDone: 2, tasksDoneChat: 1 });
  });

  it("keeps a streak alive through a week that has not had a focus day yet", () => {
    const rows = [row("2026-10-20", 25), row("2026-10-13", 25)]; // last two weeks only
    expect(summarizeStats(rows, today, "UTC").streak).toEqual({ weeks: 2, capped: false });
  });

  it("breaks the streak at the first week without a focus day", () => {
    const rows = [row(today, 25), row("2026-10-13", 25)]; // the week of Oct 19 is empty
    expect(summarizeStats(rows, today, "UTC").streak).toEqual({ weeks: 1, capped: false });
  });

  it("marks a streak that reaches the start of the window as capped", () => {
    const rows = ["2026-10-28", "2026-10-21", "2026-10-14", "2026-10-07", "2026-09-30"].map((day) =>
      row(day, 25),
    );
    expect(summarizeStats(rows, today, "UTC").streak).toEqual({ weeks: 5, capped: true });
  });

  it("fills the chart oldest first, missing days as zero", () => {
    const summary = summarizeStats([row("2026-10-20", 30)], today, "UTC");
    const bucket = summary.days.find((d) => d.day === "2026-10-20");
    expect(bucket?.focusMs).toBe(30 * 60_000);
    expect(summary.days.filter((d) => d.focusMs > 0)).toHaveLength(1);
  });
});
