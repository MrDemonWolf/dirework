import { describe, expect, it } from "vitest";

import {
  SQUIRCLE_RADIUS,
  cssLengthToPx,
  formatClock,
  quoteFontFamily,
  roundedRectPath,
  roundedRectPerimeter,
} from "../index";

describe("SQUIRCLE_RADIUS", () => {
  it("is the canonical 22% squircle fraction", () => {
    expect(SQUIRCLE_RADIUS).toBe(0.22);
  });
});

describe("roundedRectPath", () => {
  it("starts at top-center and closes the path", () => {
    const d = roundedRectPath(0, 0, 100, 100, 10);
    expect(d.startsWith("M 50 0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("clamps the radius to half the smaller side", () => {
    // r=100 on a 100x50 rect clamps to 25 → first line ends at x + w - 25
    const d = roundedRectPath(0, 0, 100, 50, 100);
    expect(d).toContain("L 75 0");
    expect(d).toContain("A 25 25");
  });

  it("draws four arcs of the given radius", () => {
    const d = roundedRectPath(5, 5, 200, 200, 44);
    expect(d.match(/A 44 44/g)).toHaveLength(4);
  });

  it("returns an empty path for zero or negative sizes", () => {
    expect(roundedRectPath(0, 0, 0, 100, 10)).toBe("");
    expect(roundedRectPath(0, 0, 100, -20, 10)).toBe("");
  });
});

describe("roundedRectPerimeter", () => {
  it("matches rectangle perimeter when r = 0", () => {
    expect(roundedRectPerimeter(100, 50, 0)).toBe(300);
  });

  it("matches circle circumference when r = half the side (square)", () => {
    expect(roundedRectPerimeter(100, 100, 50)).toBeCloseTo(2 * Math.PI * 50);
  });

  it("sums straights plus a full circle of the corner radius", () => {
    // 2*(100-20) + 2*(60-20) + 2π*10
    expect(roundedRectPerimeter(100, 60, 10)).toBeCloseTo(240 + 2 * Math.PI * 10);
  });

  it("clamps the radius the same way roundedRectPath does", () => {
    expect(roundedRectPerimeter(100, 50, 100)).toBeCloseTo(roundedRectPerimeter(100, 50, 25));
  });

  it("clamps negative radii to zero", () => {
    expect(roundedRectPerimeter(100, 50, -5)).toBe(300);
  });

  it("is zero (never negative) for zero or negative sizes", () => {
    expect(roundedRectPerimeter(-10, 50, 5)).toBe(0);
    expect(roundedRectPerimeter(50, 0, 5)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats milliseconds as MM:SS", () => {
    expect(formatClock(25 * 60 * 1000)).toBe("25:00");
    expect(formatClock(61_000)).toBe("01:01");
  });

  it("rounds partial seconds up", () => {
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(59_001)).toBe("01:00");
  });

  it("clamps negative values to 00:00", () => {
    expect(formatClock(-500)).toBe("00:00");
  });

  it("lets minutes exceed 99", () => {
    expect(formatClock(100 * 60 * 1000)).toBe("100:00");
  });

  it("treats non-finite input as 00:00", () => {
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("00:00");
  });
});

describe("cssLengthToPx", () => {
  it("reads px and unitless values as px", () => {
    expect(cssLengthToPx("250px")).toBe(250);
    expect(cssLengthToPx("120")).toBe(120);
    expect(cssLengthToPx("12.5px")).toBe(12.5);
  });

  it("converts rem/em at the 16px default and pt at 4/3", () => {
    expect(cssLengthToPx("20rem")).toBe(320);
    expect(cssLengthToPx("2em")).toBe(32);
    expect(cssLengthToPx("12pt")).toBe(16);
  });

  it("returns null for layout-relative or invalid lengths", () => {
    expect(cssLengthToPx("50%")).toBeNull();
    expect(cssLengthToPx("30vw")).toBeNull();
    expect(cssLengthToPx("auto")).toBeNull();
  });
});

describe("quoteFontFamily", () => {
  it("quotes a family whose name has a digit-led word", () => {
    expect(quoteFontFamily("Source Sans 3")).toBe('"Source Sans 3"');
  });

  it("re-quotes single-quoted names and keeps generic families bare", () => {
    expect(quoteFontFamily("'Fira Code', monospace")).toBe('"Fira Code", monospace');
    expect(quoteFontFamily("Inter,  Sans-Serif")).toBe('"Inter", Sans-Serif');
  });

  it("drops empty list entries", () => {
    expect(quoteFontFamily("Lato,,")).toBe('"Lato"');
  });
});
