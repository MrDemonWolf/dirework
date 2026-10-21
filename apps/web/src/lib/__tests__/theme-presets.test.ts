import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildTaskStylesConfig,
  buildTimerStylesConfig,
  flattenTaskStyles,
  flattenTimerStyles,
  SINGLETON_ID,
  taskStylesInputSchema,
  timerStylesInputSchema,
} from "@dirework/api/config-shared";

import {
  defaultTimerStyles,
  defaultTaskStyles,
  detectMatchingPreset,
  themePresets,
} from "../theme-presets";

// Every shipped style must pass the same allowlist the save path enforces, or
// applying a preset (or saving an untouched Theme Center) fails server-side.
// toEqual also catches keys the schema would silently strip.
function expectSavable(
  schema: typeof timerStylesInputSchema | typeof taskStylesInputSchema,
  styles: unknown,
) {
  const parsed = schema.safeParse(styles);
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  expect(parsed.data).toEqual(styles);
}

describe("default styles", () => {
  it("default timer styles pass the save-path schema", () => {
    expectSavable(timerStylesInputSchema, defaultTimerStyles);
  });

  it("default task styles pass the save-path schema", () => {
    expectSavable(taskStylesInputSchema, defaultTaskStyles);
  });
});

describe("themePresets", () => {
  it("should have 6 presets", () => {
    expect(themePresets).toHaveLength(6);
  });

  it("should have unique IDs for all presets", () => {
    const ids = themePresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(themePresets.map((p) => [p.id, p] as const))(
    "preset '%s' styles pass the save-path schemas",
    (_id, preset) => {
      expectSavable(timerStylesInputSchema, preset.timerStyles);
      expectSavable(taskStylesInputSchema, preset.taskStyles);
    },
  );

  it("the Default preset equals the shipped defaults", () => {
    const preset = themePresets.find((p) => p.id === "default");
    expect(preset?.timerStyles).toEqual(defaultTimerStyles);
    expect(preset?.taskStyles).toEqual(defaultTaskStyles);
  });

  // The API upgrades never-customized style values on read. A saved preset must
  // read back exactly as saved, or reloading the Theme Center loses the preset.
  it.each(themePresets.map((p) => [p.id, p] as const))(
    "preset '%s' reads back unchanged after a save",
    (_id, preset) => {
      const timerRow = { id: SINGLETON_ID, ...flattenTimerStyles(preset.timerStyles) };
      const taskRow = { id: SINGLETON_ID, ...flattenTaskStyles(preset.taskStyles) };
      expect(
        buildTimerStylesConfig(timerRow as Parameters<typeof buildTimerStylesConfig>[0]),
      ).toEqual(preset.timerStyles);
      expect(buildTaskStylesConfig(taskRow as Parameters<typeof buildTaskStylesConfig>[0])).toEqual(
        preset.taskStyles,
      );
    },
  );
});

describe("overlay stylesheet", () => {
  it("ships no pulsing active-task glow", () => {
    const css = readFileSync(fileURLToPath(new URL("../../index.css", import.meta.url)), "utf8");
    expect(css).not.toContain("active-glow");
  });
});

describe("detectMatchingPreset", () => {
  const clone = <T>(value: T): T => structuredClone(value);

  it.each(themePresets.map((p) => [p.id, p] as const))(
    "recognizes an exact copy of preset '%s'",
    (id, preset) => {
      expect(detectMatchingPreset(clone(preset.timerStyles), clone(preset.taskStyles))).toBe(id);
    },
  );

  it("returns null once a single value diverges from every preset", () => {
    const [preset] = themePresets;
    const timer = clone(preset!.timerStyles);
    timer.ring.width += 1;
    expect(detectMatchingPreset(timer, clone(preset!.taskStyles))).toBeNull();
  });

  it("re-detects the preset when an edit is reverted by hand", () => {
    const [preset] = themePresets;
    const timer = clone(preset!.timerStyles);
    const original = timer.ring.width;
    timer.ring.width += 1;
    timer.ring.width = original;
    expect(detectMatchingPreset(timer, clone(preset!.taskStyles))).toBe(preset!.id);
  });

  it("ignores key order (server-built configs need not match literal order)", () => {
    const [preset] = themePresets;
    const { dimensions, ...rest } = clone(preset!.timerStyles);
    const reordered = { ...rest, dimensions };
    expect(detectMatchingPreset(reordered, clone(preset!.taskStyles))).toBe(preset!.id);
  });
});
