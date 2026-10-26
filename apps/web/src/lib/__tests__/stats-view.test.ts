import { describe, expect, it } from "vitest";

import { summarizeStats } from "@dirework/api/stats-days";

import {
  CHART,
  chartBars,
  chatShareLabel,
  formatDay,
  formatFocus,
  formatFocusLong,
  shouldRefreshStats,
  statCellClass,
  statTiles,
  streakLabel,
} from "../stats-view";

const MIN = 60_000;

describe("focus formatting", () => {
  it.each([
    [0, "0m", "0 minutes"],
    [59_999, "0m", "0 minutes"],
    [MIN, "1m", "1 minute"],
    [25 * MIN, "25m", "25 minutes"],
    [60 * MIN, "1h", "1 hour"],
    [65 * MIN, "1h 5m", "1 hour 5 minutes"],
    [8 * 60 * MIN + 30 * MIN, "8h 30m", "8 hours 30 minutes"],
  ])("%d ms → %s / %s", (ms, short, long) => {
    expect(formatFocus(ms)).toBe(short);
    expect(formatFocusLong(ms)).toBe(long);
  });

  it("formats a calendar day without shifting it by the viewer's zone", () => {
    expect(formatDay("2026-10-26")).toBe("Mon, Oct 26");
  });
});

describe("tile copy", () => {
  it("describes the chat share", () => {
    expect(chatShareLabel(0, 0)).toBe("None yet");
    expect(chatShareLabel(3, 0)).toBe("All yours");
    expect(chatShareLabel(3, 3)).toBe("All from chat");
    expect(chatShareLabel(5, 2)).toBe("2 from chat");
  });

  it("describes the week streak, capped at the read window", () => {
    expect(streakLabel({ weeks: 0, capped: false })).toBe("A focus day starts a streak");
    expect(streakLabel({ weeks: 1, capped: false })).toBe("1-week streak");
    expect(streakLabel({ weeks: 5, capped: true })).toBe("5+ week streak");
  });

  it("builds the four tiles from a real summary", () => {
    const summary = summarizeStats(
      [
        {
          day: "2026-10-26",
          focusMs: 50 * MIN,
          pomodoros: 2,
          tasksDone: 4,
          tasksDoneChat: 1,
        },
      ],
      "2026-10-26",
      "UTC",
    );
    expect(statTiles(summary).map((t) => [t.label, t.value, t.detail])).toEqual([
      ["Focus today", "50m", "50m this week"],
      ["Pomodoros today", "2", "2 this week"],
      ["Tasks done today", "4", "1 from chat"],
      ["This week", "1 day", "1-week streak"],
    ]);
  });

  it("lays the strip out 2×2 on a phone and as one row from lg", () => {
    expect([0, 1, 2, 3].map(statCellClass).map((c) => c.includes("border-l"))).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(statCellClass(2)).toContain("border-t");
    expect(statCellClass(2)).toContain("lg:border-t-0");
    expect(statCellClass(1)).not.toContain("border-t");
  });
});

describe("chartBars", () => {
  const days = (minutes: number[]) =>
    minutes.map((m, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, focusMs: m * MIN }));

  it("scales to the busiest day and marks the last bar as today", () => {
    const bars = chartBars(days([0, 30, 60]));
    expect(bars.map((b) => b.today)).toEqual([false, false, true]);
    // Busiest day reaches the top; a zero day keeps the baseline stub.
    expect(bars[2]?.path).toContain(`V${CHART.radius}Q`);
    expect(bars[0]?.path).toContain(`V${CHART.height - CHART.minBar}H`);
    expect(bars[1]?.title).toBe("Fri, Oct 2: 30 minutes of focus");
  });

  it("draws only stubs when there is no focus at all", () => {
    for (const bar of chartBars(days(Array(14).fill(0)))) {
      expect(bar.path).toContain(`V${CHART.height - CHART.minBar}H`);
    }
  });

  it("caps bar width and gives each bar its whole slot as the hit area", () => {
    const bars = chartBars(days(Array(14).fill(10)));
    expect(bars).toHaveLength(14);
    expect(bars[0]?.hit.width).toBeCloseTo(CHART.width / 14);
    expect(CHART.barWidth).toBeLessThan(bars[0]?.hit.width ?? 0);
  });
});

describe("shouldRefreshStats", () => {
  it("refetches on a timer status change or a rising done count", () => {
    expect(shouldRefreshStats({ timerStatus: "work" }, { timerStatus: "break" })).toBe(true);
    expect(shouldRefreshStats({ doneCount: 2 }, { doneCount: 3 })).toBe(true);
  });

  it("ignores first sightings, unchanged values and a falling done count", () => {
    expect(shouldRefreshStats({}, { timerStatus: "work", doneCount: 3 })).toBe(false);
    expect(shouldRefreshStats({ timerStatus: "work" }, { timerStatus: "work" })).toBe(false);
    expect(shouldRefreshStats({ doneCount: 3 }, { doneCount: 0 })).toBe(false);
  });
});
