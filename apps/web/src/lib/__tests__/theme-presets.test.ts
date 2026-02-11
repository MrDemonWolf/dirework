import { describe, expect, it } from "vitest";

import { defaultTimerStyles, defaultTaskStyles, themePresets } from "../theme-presets";

describe("defaultTimerStyles", () => {
  it("should have all required style properties", () => {
    expect(defaultTimerStyles).toHaveProperty("dimensions");
    expect(defaultTimerStyles).toHaveProperty("background");
    expect(defaultTimerStyles).toHaveProperty("ring");
    expect(defaultTimerStyles).toHaveProperty("text");
    expect(defaultTimerStyles).toHaveProperty("fontSizes");
  });
});

describe("defaultTaskStyles", () => {
  it("should have all required style properties", () => {
    expect(defaultTaskStyles).toHaveProperty("display");
    expect(defaultTaskStyles).toHaveProperty("fonts");
    expect(defaultTaskStyles).toHaveProperty("scroll");
    expect(defaultTaskStyles).toHaveProperty("header");
    expect(defaultTaskStyles).toHaveProperty("body");
    expect(defaultTaskStyles).toHaveProperty("task");
    expect(defaultTaskStyles).toHaveProperty("taskDone");
    expect(defaultTaskStyles).toHaveProperty("checkbox");
    expect(defaultTaskStyles).toHaveProperty("bullet");
  });
});

describe("themePresets", () => {
  it("should have 11 presets", () => {
    expect(themePresets).toHaveLength(11);
  });

  it("should have unique IDs for all presets", () => {
    const ids = themePresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(
    themePresets.map((p) => [p.id, p] as const),
  )("preset '%s' should have required properties", (_id, preset) => {
    expect(preset.id).toBeTruthy();
    expect(preset.name).toBeTruthy();
    expect(preset.description).toBeTruthy();
    expect(preset.preview).toHaveProperty("bg");
    expect(preset.preview).toHaveProperty("accent");
    expect(preset.preview).toHaveProperty("text");
    expect(preset.timerStyles).toHaveProperty("dimensions");
    expect(preset.timerStyles).toHaveProperty("background");
    expect(preset.timerStyles).toHaveProperty("ring");
    expect(preset.timerStyles).toHaveProperty("text");
    expect(preset.timerStyles).toHaveProperty("fontSizes");
    expect(preset.taskStyles).toHaveProperty("display");
    expect(preset.taskStyles).toHaveProperty("header");
    expect(preset.taskStyles).toHaveProperty("body");
    expect(preset.taskStyles).toHaveProperty("task");
    expect(preset.taskStyles).toHaveProperty("taskDone");
  });
});
