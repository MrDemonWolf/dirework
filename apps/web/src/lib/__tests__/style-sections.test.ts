import { describe, expect, it } from "vitest";

import { DEFAULT_TASK_STYLES, DEFAULT_TIMER_STYLES } from "@dirework/api/config-defaults";

import {
  getAtPath,
  leafPaths,
  resetSection,
  STYLE_SECTIONS,
  sectionDiffers,
  setAtPath,
  TASK_STYLE_FIELDS,
  TIMER_STYLE_FIELDS,
} from "@/lib/style-sections";
import { themePresets } from "@/lib/theme-presets";
import {
  TASK_LENGTH_LIMITS,
  TASK_NUMBER_LIMITS,
  TIMER_LENGTH_LIMITS,
  TIMER_NUMBER_LIMITS,
} from "@dirework/api/style-limits";

const editors = [
  {
    name: "timer",
    fields: TIMER_STYLE_FIELDS,
    defaults: DEFAULT_TIMER_STYLES,
    presetKey: "timerStyles",
  },
  {
    name: "task",
    fields: TASK_STYLE_FIELDS,
    defaults: DEFAULT_TASK_STYLES,
    presetKey: "taskStyles",
  },
] as const;

describe.each(editors)("$name style sections", ({ name, fields, defaults, presetKey }) => {
  const keys = leafPaths(defaults);
  const paths = fields.map((field) => field.path as string);

  it("maps every style key to exactly one field", () => {
    expect([...paths].sort()).toEqual([...keys].sort());
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("puts every field in a known section, and every section has fields", () => {
    const ids = STYLE_SECTIONS.map((s) => s.id);
    for (const field of fields) expect(ids).toContain(field.section);
    for (const id of ids) expect(fields.some((f) => f.section === id)).toBe(true);
  });

  it("gives every length field exactly its save-schema limit, and every slider its range", () => {
    const lengths: Record<string, unknown> =
      name === "timer" ? TIMER_LENGTH_LIMITS : TASK_LENGTH_LIMITS;
    const numbers: Record<string, readonly [number, number]> =
      name === "timer" ? TIMER_NUMBER_LIMITS : TASK_NUMBER_LIMITS;
    const lengthPaths = fields.filter((f) => f.kind === "length").map((f) => f.path as string);
    expect(lengthPaths.sort()).toEqual(Object.keys(lengths).sort());
    for (const field of fields) {
      if (field.kind === "length") expect(field.limit, field.path).toBe(lengths[field.path]);
      if (field.kind === "slider" && field.path in numbers) {
        expect([field.min, field.max], field.path).toEqual(numbers[field.path]);
      }
    }
    const sliderPaths = fields.filter((f) => f.kind === "slider").map((f) => f.path as string);
    for (const path of Object.keys(numbers)) expect(sliderPaths).toContain(path);
  });

  it("edits the bullet and tick with the icon picker", () => {
    const icons = fields.filter((f) => f.kind === "icon").map((f) => f.path as string);
    expect(icons).toEqual(name === "task" ? ["checkbox.tickIcon", "bullet.icon"] : []);
  });

  it("files colors under Colors and opacities under Opacity", () => {
    for (const field of fields) {
      if (field.kind === "color") expect(field.section, field.path).toBe("colors");
      if (field.kind === "opacity") expect(field.section, field.path).toBe("opacity");
    }
  });

  it("resets only the chosen section, to the default values", () => {
    const preset = themePresets.find((p) => p.id === "cozy-cottage")!;
    const styles = preset[presetKey] as typeof defaults;
    expect(sectionDiffers(styles, defaults, fields as never, "colors")).toBe(true);

    const reset = resetSection(styles, defaults, fields as never, "colors");
    for (const field of fields) {
      const expected = field.section === "colors" ? defaults : styles;
      expect(getAtPath(reset, field.path), field.path).toEqual(getAtPath(expected, field.path));
    }
    expect(sectionDiffers(reset, defaults, fields as never, "colors")).toBe(false);
    // The input is never mutated.
    expect(sectionDiffers(styles, defaults, fields as never, "colors")).toBe(true);
  });
});

describe("path helpers", () => {
  it("reads and writes nested leaves without touching the source", () => {
    const source = { a: { b: { c: 1 }, d: 2 }, e: 3 };
    const next = setAtPath(source, "a.b.c", 9);
    expect(getAtPath(next, "a.b.c")).toBe(9);
    expect(getAtPath(source, "a.b.c")).toBe(1);
    expect(next.a.d).toBe(2);
    expect(next.e).toBe(3);
    expect(leafPaths(source)).toEqual(["a.b.c", "a.d", "e"]);
  });
});
