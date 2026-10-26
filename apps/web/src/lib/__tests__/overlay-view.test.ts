import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_LABELS } from "../config-types";
import { fitStaticList, overlayPath, taskOverlayView, timerOverlayView } from "../overlay-view";
import { defaultTaskStyles, defaultTimerStyles } from "../theme-presets";

const timerConfig = {
  workDuration: 50 * 60_000,
  breakDuration: 10 * 60_000,
  longBreakDuration: 30 * 60_000,
  startingDuration: 5_000,
  labels: DEFAULT_PHASE_LABELS,
  showHours: false,
};

describe("timerOverlayView", () => {
  it("renders nothing for an invalid or reset token (null payload)", () => {
    expect(timerOverlayView(null)).toBeNull();
  });

  it("renders nothing before the first payload lands", () => {
    expect(timerOverlayView(undefined)).toBeNull();
  });

  it("keeps the full idle preview for a valid instance whose timer never ran", () => {
    const view = timerOverlayView({ timerState: null, timerStyles: null, timerConfig });

    expect(view?.state.status).toBe("idle");
    // Full ring at the configured work length, not a 00:00 placeholder.
    expect(view?.totalDuration).toBe(timerConfig.workDuration);
    expect(view?.config.ring).toEqual(defaultTimerStyles.ring);
  });

  it("measures a running phase against its configured length", () => {
    const view = timerOverlayView({
      timerState: {
        status: "break",
        targetEndTime: "2026-01-01T00:00:00.000Z",
        pausedWithRemaining: null,
        pausedFromStatus: null,
        currentCycle: 2,
        totalCycles: 4,
      },
      timerStyles: null,
      timerConfig,
    });

    expect(view?.state.status).toBe("break");
    expect(view?.totalDuration).toBe(timerConfig.breakDuration);
  });
});

describe("taskOverlayView", () => {
  it("renders nothing for an invalid or reset token (null payload)", () => {
    expect(taskOverlayView(null)).toBeNull();
  });

  it("renders nothing before the first payload lands", () => {
    expect(taskOverlayView(undefined)).toBeNull();
  });

  it("renders a valid but empty list with the default styles", () => {
    const counts = { open: 0, done: 0, doneByAuthor: {} };
    const view = taskOverlayView({ tasks: [], counts, taskStyles: null });

    expect(view).toEqual({ config: defaultTaskStyles, tasks: [], counts });
  });
});

describe("overlayPath", () => {
  it("builds the timer and task overlay paths", () => {
    expect(overlayPath("timer", "abc")).toBe("/overlay/t/abc");
    expect(overlayPath("tasks", "abc")).toBe("/overlay/l/abc");
  });

  it("returns null without a token instead of /overlay/t/null", () => {
    expect(overlayPath("timer", null)).toBeNull();
    expect(overlayPath("tasks", undefined)).toBeNull();
    expect(overlayPath("timer", "")).toBeNull();
  });
});

describe("fitStaticList", () => {
  // One author group: its card's bottom edge and each row's bottom edge.
  const group = (rowBottoms: number[], bottom = (rowBottoms.at(-1) ?? 40) + 4) => ({
    bottom,
    rowBottoms,
  });
  const hidden = (...args: Parameters<typeof fitStaticList>) => fitStaticList(...args).hidden;

  it("hides nothing when every row fits the whole area", () => {
    expect(fitStaticList([group([50, 100, 150])], 200, 30)).toEqual({
      hidden: 0,
      groups: [{ visibleRows: 3, clipBottom: 0 }],
    });
  });

  it("returns to all shown once rows fit, even though they would not fit above the footer", () => {
    // 190 > 200 - 30, but the footer only exists while something overflows:
    // after a row is removed everything fits the full area and the footer goes.
    expect(hidden([group([50, 100, 190, 250])], 200, 30)).toBe(2);
    expect(hidden([group([50, 100, 190])], 200, 30)).toBe(0);
  });

  it("hides a partly cut-off row whole instead of drawing half of it", () => {
    expect(fitStaticList([group([100, 201], 205)], 200, 0)).toEqual({
      hidden: 1,
      groups: [{ visibleRows: 1, clipBottom: 105 }],
    });
  });

  it("clips a cut group to end at its last shown row", () => {
    const fit = fitStaticList([group([60, 110, 175, 210], 214)], 200, 30);
    expect(fit.hidden).toBe(2);
    // Rows must end above the footer (170): the card is clipped up from 214 to 110.
    expect(fit.groups[0]).toEqual({ visibleRows: 2, clipBottom: 104 });
  });

  it("hides a later group whole, header included, when none of its rows fits", () => {
    // Group 2's header starts at 128 and fits, but its first row ends at 190 > 170.
    const fit = fitStaticList([group([60, 120]), group([190, 240])], 200, 30);
    expect(fit.groups).toEqual([
      { visibleRows: 2, clipBottom: 0 },
      { visibleRows: 0, clipBottom: 0 },
    ]);
    expect(fit.hidden).toBe(2);
  });

  it("never shows a row after a hidden one", () => {
    // Defensive: even if a later row measured shorter, the list stops at the first miss.
    const fit = fitStaticList([group([40]), group([180]), group([165]), group([230])], 200, 30);
    expect(fit.groups.map((g) => g.visibleRows)).toEqual([1, 0, 0, 0]);
    expect(fit.hidden).toBe(3);
  });

  it("handles an empty list", () => {
    expect(fitStaticList([], 200, 30)).toEqual({ hidden: 0, groups: [] });
  });
});
