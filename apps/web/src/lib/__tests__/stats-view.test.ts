import { afterEach, describe, expect, it, vi } from "vitest";

import { summarizeStats } from "@dirework/api/stats-days";

import {
  CHART,
  chartBars,
  chatShareLabel,
  formatDay,
  formatFocus,
  formatFocusLong,
  latestCompletion,
  msUntilNextLocalDay,
  scheduleDayRollover,
  timerPhaseKey,
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

describe("timer phase identity", () => {
  const work = (cycle: number, end: string) => ({
    status: "work",
    currentCycle: cycle,
    totalCycles: 4,
    targetEndTime: end,
  });

  it("refetches when two polls both see `work` but a whole break passed between them", () => {
    const before = timerPhaseKey(work(1, "2026-10-26T10:25:00Z"));
    const after = timerPhaseKey(work(2, "2026-10-26T10:55:00Z"));
    expect(shouldRefreshStats({ timerPhase: before }, { timerPhase: after })).toBe(true);
  });

  it("refetches when a session was restarted into the same phase and cycle", () => {
    const before = timerPhaseKey(work(1, "2026-10-26T10:25:00Z"));
    const after = timerPhaseKey(work(1, "2026-10-26T12:25:00Z"));
    expect(shouldRefreshStats({ timerPhase: before }, { timerPhase: after })).toBe(true);
  });

  it("is stable while the same phase keeps running, and unknown before timer.get loads", () => {
    const phase = work(1, "2026-10-26T10:25:00Z");
    expect(timerPhaseKey(phase)).toBe(timerPhaseKey({ ...phase }));
    expect(timerPhaseKey(null)).toBeUndefined();
    expect(timerPhaseKey(undefined)).toBeUndefined();
    expect(timerPhaseKey({ status: "idle", targetEndTime: null })).toBe("idle|||");
  });
});

describe("shouldRefreshStats", () => {
  const done = (id: string, at: string) => ({ id, status: "done", completedAt: at });
  const open = { id: "o", status: "pending", completedAt: null };

  it("refetches on a timer status change or a newer completion", () => {
    expect(shouldRefreshStats({ timerPhase: "work|1|4|1" }, { timerPhase: "break|1|4|2" })).toBe(
      true,
    );
    expect(shouldRefreshStats({ latestDoneAt: 1000 }, { latestDoneAt: 2000 })).toBe(true);
    // The first completion after a clear (or on a fresh day).
    expect(shouldRefreshStats({ latestDoneAt: null }, { latestDoneAt: 2000 })).toBe(true);
  });

  it("sees a completion even when the purge keeps the done count level", () => {
    // One task finished while one expired completion was purged: same count, newer newest.
    const before = [done("old", "2026-10-25T09:00:00Z"), done("a", "2026-10-26T09:00:00Z")];
    const after = [done("a", "2026-10-26T09:00:00Z"), done("b", "2026-10-26T10:00:00Z"), open];
    expect(before.length).toBe(after.filter((t) => t.status === "done").length);
    expect(
      shouldRefreshStats(
        { latestDoneAt: latestCompletion(before) },
        { latestDoneAt: latestCompletion(after) },
      ),
    ).toBe(true);
  });

  it("ignores first sightings, unchanged values, a purge, a clear and an undo of a removal", () => {
    expect(shouldRefreshStats({}, { timerPhase: "work|1|4|1", latestDoneAt: 3 })).toBe(false);
    expect(shouldRefreshStats({ timerPhase: "work|1|4|1" }, { timerPhase: "work|1|4|1" })).toBe(
      false,
    );
    expect(shouldRefreshStats({ latestDoneAt: 3000 }, { latestDoneAt: 3000 })).toBe(false);
    expect(shouldRefreshStats({ latestDoneAt: 3000 }, { latestDoneAt: null })).toBe(false);
    // A restored done task keeps its old completedAt, so the newest doesn't move forward.
    expect(shouldRefreshStats({ latestDoneAt: 3000 }, { latestDoneAt: 3000 })).toBe(false);
  });

  it("finds the newest completion among done rows only", () => {
    expect(latestCompletion([open])).toBeNull();
    expect(
      latestCompletion([done("a", "2026-10-26T09:00:00Z"), done("b", "2026-10-26T08:00:00Z")]),
    ).toBe(Date.parse("2026-10-26T09:00:00Z"));
  });
});

describe("day rollover", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits until just past the next local midnight", () => {
    const now = new Date(2026, 9, 26, 23, 59, 0);
    const wait = msUntilNextLocalDay(now);
    const fireAt = new Date(now.getTime() + wait);
    expect(fireAt.getDate()).toBe(27);
    expect(wait).toBe(61_000);
  });

  it("refreshes once per local midnight while open, and stops when cancelled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 22, 0, 0));
    const onRollover = vi.fn();
    const cancel = scheduleDayRollover(onRollover);

    vi.advanceTimersByTime(2 * 60 * 60_000 - 1000); // 23:59:59 — not yet
    expect(onRollover).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000); // 00:00:01
    expect(onRollover).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 60 * 60_000); // the next midnight
    expect(onRollover).toHaveBeenCalledTimes(2);

    cancel();
    vi.advanceTimersByTime(48 * 60 * 60_000);
    expect(onRollover).toHaveBeenCalledTimes(2);
  });
});
