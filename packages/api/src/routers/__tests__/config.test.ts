import { describe, expect, it } from "vitest";

import { defaultTimerConfig } from "../config";

describe("defaultTimerConfig", () => {
  it("should have all 7 phase label keys", () => {
    const labels = defaultTimerConfig.labels;
    expect(labels).toHaveProperty("idle");
    expect(labels).toHaveProperty("starting");
    expect(labels).toHaveProperty("work");
    expect(labels).toHaveProperty("break");
    expect(labels).toHaveProperty("longBreak");
    expect(labels).toHaveProperty("paused");
    expect(labels).toHaveProperty("finished");
  });

  it("should have non-empty string values for all labels", () => {
    for (const [, value] of Object.entries(defaultTimerConfig.labels)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("should have correct timer duration defaults", () => {
    expect(defaultTimerConfig.workDuration).toBe(25 * 60 * 1000);
    expect(defaultTimerConfig.breakDuration).toBe(5 * 60 * 1000);
    expect(defaultTimerConfig.longBreakDuration).toBe(15 * 60 * 1000);
    expect(defaultTimerConfig.longBreakInterval).toBe(4);
    expect(defaultTimerConfig.defaultCycles).toBe(4);
  });
});
