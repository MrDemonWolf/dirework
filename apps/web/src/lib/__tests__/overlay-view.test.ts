import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_LABELS } from "../config-types";
import { countHiddenRows, overlayPath, taskOverlayView, timerOverlayView } from "../overlay-view";
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

describe("countHiddenRows", () => {
  it("hides nothing when every row fits the whole area", () => {
    expect(countHiddenRows([50, 100, 150], 200, 30)).toBe(0);
  });

  it("returns to 0 once rows fit, even though they would not fit above the footer", () => {
    // 190 > 200 - 30, but the footer only exists while something overflows:
    // after a row is removed everything fits the full area and the footer goes.
    expect(countHiddenRows([50, 100, 190, 250], 200, 30)).toBe(2);
    expect(countHiddenRows([50, 100, 190], 200, 30)).toBe(0);
  });

  it("counts rows below the space left above the footer when something overflows", () => {
    expect(countHiddenRows([50, 100, 160, 180, 260], 200, 30)).toBe(2);
  });

  it("counts a partly cut-off row as hidden", () => {
    expect(countHiddenRows([100, 201], 200, 0)).toBe(1);
  });

  it("handles an empty list", () => {
    expect(countHiddenRows([], 200, 30)).toBe(0);
  });
});
