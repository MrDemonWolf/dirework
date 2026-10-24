import { describe, expect, it } from "vitest";

import { DEFAULT_TIMER_STYLES } from "../config-types";
import { themePresets } from "../theme-presets";
import {
  FIT_PADDING_PX,
  MIN_FIT_SCALE,
  availableWidth,
  fitShape,
  fitTimerLines,
  scaledFontSize,
} from "../timer-fit";

const RING = { enabled: true, width: 14, gap: 10 };
const GAP = 4;

/** Line boxes the default 300×300 timer measured in Chromium (Montserrat, 24/76/20). */
const LABEL = { width: 214, height: 29 };
const CLOCK = { width: 228, height: 84 };
const CYCLE = { width: 26, height: 24 };

/** Where each line lands once `fits` are applied, for checking the result geometrically. */
function placed(frameHeight: number, lines: { width: number; height: number }[], scales: number[]) {
  const heights = lines.map((line, i) => line.height * (scales[i] ?? 1));
  let y = (frameHeight - heights.reduce((a, b) => a + b, 0) - GAP * (lines.length - 1)) / 2;
  return lines.map((line, i) => {
    const top = y;
    y += (heights[i] ?? 0) + GAP;
    return { top, bottom: top + (heights[i] ?? 0), width: line.width * (scales[i] ?? 1) };
  });
}

describe("fitShape", () => {
  it("puts the text area inside the ring stroke's inner edge", () => {
    const shape = fitShape(300, 300, "22%", RING);
    expect(shape).toMatchObject({ kind: "rect", left: 24, top: 24, right: 276, bottom: 276 });
    // 22% of the 266px centerline box, less half the stroke.
    expect(shape.kind === "rect" && shape.radius).toBeCloseTo(0.22 * 266 - 7, 5);
  });

  it("is a circle on the shorter side for a 50% radius", () => {
    expect(fitShape(400, 300, "50%", RING)).toEqual({
      kind: "circle",
      cx: 200,
      cy: 150,
      radius: 150 - 24,
    });
  });

  it("uses the whole panel when the ring is off", () => {
    expect(fitShape(300, 300, "50%", { ...RING, enabled: false })).toMatchObject({ radius: 150 });
    expect(fitShape(300, 200, "0px", { ...RING, enabled: false })).toMatchObject({
      left: 0,
      right: 300,
      top: 0,
      bottom: 200,
      radius: 0,
    });
  });

  it("uses the whole panel when the frame has no room to draw the ring", () => {
    // ProgressRing draws nothing once a side is no longer than 2 × (14 / 2 + 10) = 34px;
    // reserving that ring's inset anyway would leave the text a zero-sized area.
    const off = { ...RING, enabled: false };
    expect(fitShape(30, 30, "22%", RING)).toEqual(fitShape(30, 30, "22%", off));
    expect(fitShape(34, 300, "50%", RING)).toEqual(fitShape(34, 300, "50%", off));
    expect(fitShape(400, 34, "0px", RING)).toEqual(fitShape(400, 34, "0px", off));
  });

  it("reads px corner radii and the first value of a shorthand", () => {
    const shape = fitShape(300, 300, "40px 0 0 0", RING);
    expect(shape.kind === "rect" && shape.radius).toBe(40 - 7);
  });
});

describe("availableWidth", () => {
  it("is the full inner width, less padding, across the middle of a rounded rect", () => {
    const shape = fitShape(300, 300, "22%", RING);
    expect(availableWidth(shape, 120, 180)).toBe(252 - 2 * FIT_PADDING_PX);
  });

  it("narrows inside a corner band and in a circle away from the center", () => {
    const rect = fitShape(300, 300, "22%", RING);
    expect(availableWidth(rect, 30, 60)).toBeLessThan(availableWidth(rect, 120, 180));
    const circle = fitShape(300, 300, "50%", RING);
    const middle = availableWidth(circle, 140, 160);
    const high = availableWidth(circle, 80, 110);
    expect(middle).toBeGreaterThan(high);
    // Chord of the 126px inner radius at the band's far edge (70px above center).
    expect(high).toBeCloseTo(2 * (Math.sqrt(126 ** 2 - 70 ** 2) - FIT_PADDING_PX), 5);
  });

  it("is zero outside the shape", () => {
    expect(availableWidth(fitShape(300, 300, "50%", RING), 0, 10)).toBe(0);
  });
});

describe("fitTimerLines", () => {
  it("leaves lines that already fit at their configured size", () => {
    const shape = fitShape(300, 300, "22%", RING);
    const fits = fitTimerLines(shape, 300, [LABEL, { width: 190, height: 70 }, CYCLE], GAP);
    expect(fits).toEqual([
      { scale: 1, maxWidth: null },
      { scale: 1, maxWidth: null },
      { scale: 1, maxWidth: null },
    ]);
  });

  it("shrinks a too-wide label so it ends inside the ring, and never grows a line", () => {
    const shape = fitShape(300, 300, "22%", RING);
    const lines = [{ width: 330, height: 29 }, CLOCK, CYCLE];
    const fits = fitTimerLines(shape, 300, lines, GAP);
    expect(fits[0]?.scale).toBeLessThan(1);
    for (const fit of fits) expect(fit.scale).toBeLessThanOrEqual(1);
    const boxes = placed(
      300,
      lines,
      fits.map((fit) => fit.scale),
    );
    boxes.forEach((box) => {
      expect(box.width).toBeLessThanOrEqual(availableWidth(shape, box.top, box.bottom) + 1e-9);
    });
  });

  it("fits every line inside a circle ring, where the top line's chord is narrower", () => {
    const shape = fitShape(300, 300, "50%", RING);
    const lines = [LABEL, CLOCK, CYCLE];
    const fits = fitTimerLines(shape, 300, lines, GAP);
    // The label sits highest, so it shrinks although the same width fits a rounded rect.
    expect(fits[0]?.scale).toBeLessThan(1);
    const boxes = placed(
      300,
      lines,
      fits.map((fit) => fit.scale),
    );
    boxes.forEach((box) => {
      expect(box.width).toBeLessThanOrEqual(availableWidth(shape, box.top, box.bottom) + 1e-9);
    });
  });

  it("shrinks the whole stack when it is taller than the ring", () => {
    const shape = fitShape(300, 300, "22%", RING);
    const lines = [
      { width: 100, height: 120 },
      { width: 100, height: 200 },
      { width: 50, height: 60 },
    ];
    const fits = fitTimerLines(shape, 300, lines, GAP);
    const boxes = placed(
      300,
      lines,
      fits.map((fit) => fit.scale),
    );
    expect(boxes[0]!.top).toBeGreaterThanOrEqual(24 + FIT_PADDING_PX - 1e-9);
    expect(boxes[2]!.bottom).toBeLessThanOrEqual(276 - FIT_PADDING_PX + 1e-9);
  });

  it("keeps every line visible in a frame too small to draw the ring", () => {
    // The ring is skipped there, so the text gets the 30px panel; fitting it into the
    // skipped ring's zero-sized interior scaled every line to 0 and blanked the timer.
    const fits = fitTimerLines(fitShape(30, 30, "22%", RING), 30, [LABEL, CLOCK, CYCLE], GAP);
    for (const fit of fits) expect(fit.scale).toBeGreaterThan(0);
  });

  it("never shrinks below MIN_FIT_SCALE in a frame shorter than the stack", () => {
    // A 300x20 panel has no vertical room after padding and gaps: the uniform vertical
    // shrink scaled every line to 0 and blanked the timer. The floor holds and each line
    // keeps the panel's width through its middle.
    const shape = fitShape(300, 20, "0", RING);
    const fits = fitTimerLines(shape, 20, [LABEL, CLOCK, CYCLE], GAP);
    for (const fit of fits) {
      expect(fit.scale).toBeGreaterThanOrEqual(MIN_FIT_SCALE);
      if (fit.maxWidth !== null) expect(fit.maxWidth).toBeGreaterThan(0);
    }
  });

  it("stops at MIN_FIT_SCALE and clips with an ellipsis width past it", () => {
    const shape = fitShape(300, 300, "22%", RING);
    const fits = fitTimerLines(shape, 300, [{ width: 1200, height: 29 }, CLOCK, CYCLE], GAP);
    expect(fits[0]?.scale).toBe(MIN_FIT_SCALE);
    expect(fits[0]?.maxWidth).toBeGreaterThan(0);
    expect(fits[0]?.maxWidth).toBeLessThanOrEqual(252 - 2 * FIT_PADDING_PX);
    expect(fits[1]?.maxWidth).toBeNull();
  });

  it("gives the default theme and every preset room around the 25:00 clock", () => {
    // Montserrat's "25:00" advance is about 3.0em; at the shipped size it must leave a
    // visible margin to the ring, not just squeeze in.
    for (const styles of [DEFAULT_TIMER_STYLES, ...themePresets.map((p) => p.timerStyles)]) {
      const width = Number.parseFloat(styles.dimensions.width);
      const height = Number.parseFloat(styles.dimensions.height);
      const shape = fitShape(width, height, styles.background.borderRadius, styles.ring);
      const clockWidth = 3 * Number.parseFloat(styles.fontSizes.time);
      expect(availableWidth(shape, height / 2 - 20, height / 2 + 20) - clockWidth).toBeGreaterThan(
        24,
      );
    }
  });
});

describe("scaledFontSize", () => {
  it("keeps the configured size at scale 1 and multiplies it below", () => {
    expect(scaledFontSize("24px", 1)).toBe("24px");
    expect(scaledFontSize("calc(76px * 0.646)", 0.9)).toBe("calc(calc(76px * 0.646) * 0.9)");
  });
});
