import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_LABELS } from "../config-types";
import { taskOverlayView, timerOverlayView } from "../overlay-view";
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
