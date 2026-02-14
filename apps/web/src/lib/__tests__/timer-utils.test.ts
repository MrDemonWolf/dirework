import { describe, expect, it } from "vitest";

import { toHexOpacity, formatTime, roundedRectPath } from "../timer-utils";

describe("toHexOpacity", () => {
  it("should return '00' for opacity 0", () => {
    expect(toHexOpacity(0)).toBe("00");
  });

  it("should return '80' for opacity ~0.5", () => {
    // 0.5 * 255 = 127.5, rounds to 128 = 0x80
    expect(toHexOpacity(0.5)).toBe("80");
  });

  it("should return 'f2' for opacity 0.95", () => {
    // 0.95 * 255 = 242.25, rounds to 242 = 0xf2
    expect(toHexOpacity(0.95)).toBe("f2");
  });

  it("should return 'ff' for opacity 1.0", () => {
    expect(toHexOpacity(1.0)).toBe("ff");
  });

  it("should pad single-digit hex values", () => {
    // 0.01 * 255 = 2.55, rounds to 3 = 0x03
    expect(toHexOpacity(0.01)).toBe("03");
  });
});

describe("formatTime", () => {
  it("should format zero ms", () => {
    const result = formatTime(0, false);
    expect(result).toEqual({ hours: "00", minutes: "00", seconds: "00" });
  });

  it("should format negative ms as zero", () => {
    const result = formatTime(-5000, false);
    expect(result).toEqual({ hours: "00", minutes: "00", seconds: "00" });
  });

  it("should format 25 minutes without showHours", () => {
    const result = formatTime(25 * 60 * 1000, false);
    expect(result.minutes).toBe("25");
    expect(result.seconds).toBe("00");
  });

  it("should format 25 minutes with showHours", () => {
    const result = formatTime(25 * 60 * 1000, true);
    expect(result.hours).toBe("00");
    expect(result.minutes).toBe("25");
    expect(result.seconds).toBe("00");
  });

  it("should handle hour boundary with showHours=false (minutes exceed 59)", () => {
    const ms = 90 * 60 * 1000; // 90 minutes
    const result = formatTime(ms, false);
    expect(result.minutes).toBe("90");
    expect(result.seconds).toBe("00");
  });

  it("should handle hour boundary with showHours=true (wraps minutes)", () => {
    const ms = 90 * 60 * 1000; // 1h 30m
    const result = formatTime(ms, true);
    expect(result.hours).toBe("01");
    expect(result.minutes).toBe("30");
    expect(result.seconds).toBe("00");
  });

  it("should ceil partial seconds", () => {
    const result = formatTime(100, false); // 0.1 seconds → ceil to 1
    expect(result.seconds).toBe("01");
  });
});

describe("roundedRectPath", () => {
  it("should produce valid SVG path commands", () => {
    const path = roundedRectPath(10, 10, 200, 200, 20);
    expect(path).toContain("M ");
    expect(path).toContain("L ");
    expect(path).toContain("A ");
    expect(path).toContain("Z");
  });

  it("should start at top-center", () => {
    const path = roundedRectPath(0, 0, 100, 100, 10);
    expect(path).toMatch(/^M 50 0/);
  });

  it("should clamp radius to half of smallest dimension", () => {
    // w=100, h=60 → max r = 30
    const path = roundedRectPath(0, 0, 100, 60, 50);
    // With r clamped to 30, the first L should be at x + w - r = 70
    expect(path).toContain("L 70 0");
  });

  it("should handle zero radius (sharp corners)", () => {
    const path = roundedRectPath(0, 0, 100, 100, 0);
    // Arc radius should be 0
    expect(path).toContain("A 0 0");
  });
});
