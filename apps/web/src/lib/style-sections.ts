// The Theme Center's editor layout: every timer and task style key belongs to exactly one
// section (Colors · Typography · Layout · Opacity) and carries the field that edits it.
// The editors render from these lists, "Reset section" resets by them, and a test holds
// both maps to the full set of style keys, so a new style key can't go missing from the
// editor or from a reset.

import { glyphSchema } from "@dirework/api/config-shared";

import type { TaskStylesConfig, TimerStylesConfig } from "@/lib/config-types";

export type StyleSection = "colors" | "typography" | "layout" | "opacity";

/** Section order on the page; Colors opens first. */
export const STYLE_SECTIONS: readonly { id: StyleSection; title: string; noun: string }[] = [
  { id: "colors", title: "Colors", noun: "color" },
  { id: "typography", title: "Typography", noun: "font and text size" },
  { id: "layout", title: "Layout", noun: "size, spacing and display setting" },
  { id: "opacity", title: "Opacity", noun: "opacity" },
];

/** Dot paths to every leaf of a style object (`ring.fillColor`, `body.padding.vertical`). */
export type LeafPath<T> = {
  [K in keyof T & string]: T[K] extends object ? `${K}.${LeafPath<T[K]>}` : K;
}[keyof T & string];

type FieldKind =
  | { kind: "color"; hint?: string }
  | { kind: "opacity" }
  | {
      kind: "length";
      unit?: "px";
      placeholder?: string;
    }
  | {
      kind: "text";
      schema?: { safeParse: (value: string) => { success: boolean } };
      invalidHint?: string;
    }
  | { kind: "slider"; min: number; max: number; unit?: "px" }
  | { kind: "switch" }
  | { kind: "font" };

/** One editor row: the key it edits, the part of the overlay it belongs to, and its control. */
export type StyleField<T> = FieldKind & {
  path: LeafPath<T>;
  /** The overlay part the row sits under inside its section ("Progress ring", "Header"). */
  group: string;
  label: string;
  section: StyleSection;
  /** Not rendered while this returns true (bullet rows while checkboxes are on). */
  hidden?: (styles: T) => boolean;
  /** Rendered but inactive while this returns true (scroll speed while scroll is off). */
  disabled?: (styles: T) => boolean;
  /** A line under the row, when it applies. */
  note?: (styles: T) => string | null;
};

type TimerField = StyleField<TimerStylesConfig>;
type TaskField = StyleField<TaskStylesConfig>;

export const TIMER_STYLE_FIELDS: readonly TimerField[] = [
  // Colors
  {
    path: "background.color",
    group: "Panel",
    label: "Background",
    section: "colors",
    kind: "color",
  },
  {
    path: "ring.fillColor",
    group: "Progress ring",
    label: "Fill",
    section: "colors",
    kind: "color",
  },
  {
    path: "ring.trackColor",
    group: "Progress ring",
    label: "Track",
    section: "colors",
    kind: "color",
  },
  { path: "text.color", group: "Text", label: "Color", section: "colors", kind: "color" },
  { path: "text.outlineColor", group: "Text", label: "Outline", section: "colors", kind: "color" },
  // Typography
  {
    path: "text.fontFamily",
    group: "Text",
    label: "Font family",
    section: "typography",
    kind: "font",
  },
  {
    path: "text.outlineSize",
    group: "Text",
    label: "Outline size",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "2px",
  },
  {
    path: "fontSizes.label",
    group: "Font sizes",
    label: "Phase label",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "16px",
  },
  {
    path: "fontSizes.time",
    group: "Font sizes",
    label: "Time",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "48px",
  },
  {
    path: "fontSizes.cycle",
    group: "Font sizes",
    label: "Pomo counter",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "14px",
  },
  // Layout — the overlay draws at this fixed size and AutoScale fits it to the OBS source.
  // The progress ring needs absolute lengths: with %/vw/vh TimerDisplay skips it.
  {
    path: "dimensions.width",
    group: "Size",
    label: "Width",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "280px",
  },
  {
    path: "dimensions.height",
    group: "Size",
    label: "Height",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "280px",
  },
  {
    path: "background.borderRadius",
    group: "Panel",
    label: "Corner radius",
    section: "layout",
    kind: "length",
    placeholder: "50%",
  },
  {
    path: "ring.enabled",
    group: "Progress ring",
    label: "Show ring",
    section: "layout",
    kind: "switch",
  },
  {
    path: "ring.width",
    group: "Progress ring",
    label: "Ring width",
    section: "layout",
    kind: "slider",
    min: 2,
    max: 24,
    unit: "px",
  },
  {
    path: "ring.gap",
    group: "Progress ring",
    label: "Ring gap",
    section: "layout",
    kind: "slider",
    min: 0,
    max: 16,
    unit: "px",
  },
  // Opacity
  {
    path: "background.opacity",
    group: "Panel",
    label: "Background",
    section: "opacity",
    kind: "opacity",
  },
  {
    path: "ring.fillOpacity",
    group: "Progress ring",
    label: "Fill",
    section: "opacity",
    kind: "opacity",
  },
  {
    path: "ring.trackOpacity",
    group: "Progress ring",
    label: "Track",
    section: "opacity",
    kind: "opacity",
  },
];

const bulletsHidden = (s: TaskStylesConfig) => s.display.useCheckboxes;
const scrollOff = (s: TaskStylesConfig) => !s.scroll.enabled;
const glyph = { schema: glyphSchema, invalidHint: "Use 1 to 8 characters" } as const;

export const TASK_STYLE_FIELDS: readonly TaskField[] = [
  // Colors
  {
    path: "header.background.color",
    group: "Header",
    label: "Background",
    section: "colors",
    kind: "color",
  },
  { path: "header.fontColor", group: "Header", label: "Text", section: "colors", kind: "color" },
  {
    path: "header.border.color",
    group: "Header",
    label: "Border",
    section: "colors",
    kind: "color",
  },
  {
    path: "body.background.color",
    group: "Body",
    label: "Background",
    section: "colors",
    kind: "color",
  },
  { path: "body.border.color", group: "Body", label: "Border", section: "colors", kind: "color" },
  {
    path: "task.background.color",
    group: "Task rows",
    label: "Background",
    section: "colors",
    kind: "color",
  },
  { path: "task.fontColor", group: "Task rows", label: "Text", section: "colors", kind: "color" },
  {
    path: "task.usernameColor",
    group: "Task rows",
    label: "Fallback username",
    section: "colors",
    kind: "color",
    hint: "Used when a viewer has no Twitch chat color.",
  },
  {
    path: "task.border.color",
    group: "Task rows",
    label: "Border",
    section: "colors",
    kind: "color",
  },
  {
    path: "taskDone.background.color",
    group: "Done tasks",
    label: "Background",
    section: "colors",
    kind: "color",
  },
  {
    path: "taskDone.fontColor",
    group: "Done tasks",
    label: "Text",
    section: "colors",
    kind: "color",
  },
  {
    path: "checkbox.background.color",
    group: "Checkbox",
    label: "Background",
    section: "colors",
    kind: "color",
  },
  {
    path: "checkbox.border.color",
    group: "Checkbox",
    label: "Border",
    section: "colors",
    kind: "color",
  },
  {
    path: "checkbox.tickColor",
    group: "Checkbox",
    label: "Tick",
    section: "colors",
    kind: "color",
  },
  {
    path: "bullet.color",
    group: "Bullet",
    label: "Bullet",
    section: "colors",
    kind: "color",
    hidden: bulletsHidden,
  },
  // Typography
  {
    path: "fonts.header",
    group: "Fonts",
    label: "Header font",
    section: "typography",
    kind: "font",
  },
  { path: "fonts.body", group: "Fonts", label: "Body font", section: "typography", kind: "font" },
  {
    path: "header.fontSize",
    group: "Header",
    label: "Font size",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "24px",
  },
  {
    path: "task.fontSize",
    group: "Task rows",
    label: "Font size",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "16px",
  },
  {
    path: "checkbox.tickChar",
    group: "Checkbox",
    label: "Tick character",
    section: "typography",
    kind: "text",
    ...glyph,
  },
  {
    path: "checkbox.tickSize",
    group: "Checkbox",
    label: "Tick size",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "14px",
  },
  {
    path: "bullet.char",
    group: "Bullet",
    label: "Character",
    section: "typography",
    kind: "text",
    ...glyph,
    hidden: bulletsHidden,
  },
  {
    path: "bullet.size",
    group: "Bullet",
    label: "Size",
    section: "typography",
    kind: "length",
    unit: "px",
    placeholder: "16px",
    hidden: bulletsHidden,
  },
  // Layout
  {
    path: "display.showDone",
    group: "Display",
    label: "Show done tasks",
    section: "layout",
    kind: "switch",
  },
  {
    path: "display.showCount",
    group: "Display",
    label: "Show task count",
    section: "layout",
    kind: "switch",
  },
  {
    path: "display.useCheckboxes",
    group: "Display",
    label: "Checkboxes",
    section: "layout",
    kind: "switch",
    note: (s) =>
      s.display.useCheckboxes ? "Bullet options appear when checkboxes are off." : null,
  },
  {
    path: "display.crossOnDone",
    group: "Display",
    label: "Cross out done tasks",
    section: "layout",
    kind: "switch",
  },
  {
    path: "display.numberOfLines",
    group: "Display",
    label: "Lines per task",
    section: "layout",
    kind: "slider",
    min: 1,
    max: 5,
  },
  {
    path: "scroll.enabled",
    group: "Scroll",
    label: "Scroll long lists",
    section: "layout",
    kind: "switch",
  },
  {
    path: "scroll.pixelsPerSecond",
    group: "Scroll",
    label: "Speed (px/s)",
    section: "layout",
    kind: "slider",
    min: 1,
    max: 200,
    disabled: scrollOff,
  },
  {
    path: "scroll.gapBetweenLoops",
    group: "Scroll",
    label: "Loop gap",
    section: "layout",
    kind: "slider",
    min: 0,
    max: 300,
    unit: "px",
    disabled: scrollOff,
  },
  {
    path: "header.height",
    group: "Header",
    label: "Height",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "60px",
  },
  {
    path: "header.padding",
    group: "Header",
    label: "Padding",
    section: "layout",
    kind: "length",
    placeholder: "10px",
  },
  {
    path: "header.border.width",
    group: "Header",
    label: "Border width",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "2px",
  },
  {
    path: "header.border.radius",
    group: "Header",
    label: "Corner radius",
    section: "layout",
    kind: "length",
    placeholder: "8px",
  },
  {
    path: "body.padding.vertical",
    group: "Body",
    label: "Vertical padding",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "10px",
  },
  {
    path: "body.padding.horizontal",
    group: "Body",
    label: "Horizontal padding",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "10px",
  },
  {
    path: "body.border.width",
    group: "Body",
    label: "Border width",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "2px",
  },
  {
    path: "body.border.radius",
    group: "Body",
    label: "Corner radius",
    section: "layout",
    kind: "length",
    placeholder: "8px",
  },
  {
    path: "task.padding",
    group: "Task rows",
    label: "Padding",
    section: "layout",
    kind: "length",
    placeholder: "8px",
  },
  {
    path: "task.marginBottom",
    group: "Task rows",
    label: "Margin bottom",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "8px",
  },
  {
    path: "task.maxWidth",
    group: "Task rows",
    label: "Max width",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "300px",
  },
  {
    path: "task.border.width",
    group: "Task rows",
    label: "Border width",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "2px",
  },
  {
    path: "task.border.radius",
    group: "Task rows",
    label: "Corner radius",
    section: "layout",
    kind: "length",
    placeholder: "8px",
  },
  {
    path: "checkbox.size",
    group: "Checkbox",
    label: "Size",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "20px",
  },
  {
    path: "checkbox.border.width",
    group: "Checkbox",
    label: "Border width",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "2px",
  },
  {
    path: "checkbox.border.radius",
    group: "Checkbox",
    label: "Corner radius",
    section: "layout",
    kind: "length",
    placeholder: "4px",
  },
  {
    path: "checkbox.margin.top",
    group: "Checkbox",
    label: "Margin top",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "2px",
  },
  {
    path: "checkbox.margin.left",
    group: "Checkbox",
    label: "Margin left",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "0px",
  },
  {
    path: "checkbox.margin.right",
    group: "Checkbox",
    label: "Margin right",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "8px",
  },
  {
    path: "bullet.margin.top",
    group: "Bullet",
    label: "Margin top",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "2px",
    hidden: bulletsHidden,
  },
  {
    path: "bullet.margin.left",
    group: "Bullet",
    label: "Margin left",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "0px",
    hidden: bulletsHidden,
  },
  {
    path: "bullet.margin.right",
    group: "Bullet",
    label: "Margin right",
    section: "layout",
    kind: "length",
    unit: "px",
    placeholder: "8px",
    hidden: bulletsHidden,
  },
  // Opacity
  {
    path: "header.background.opacity",
    group: "Header",
    label: "Background",
    section: "opacity",
    kind: "opacity",
  },
  {
    path: "body.background.opacity",
    group: "Body",
    label: "Background",
    section: "opacity",
    kind: "opacity",
  },
  {
    path: "task.background.opacity",
    group: "Task rows",
    label: "Background",
    section: "opacity",
    kind: "opacity",
  },
  {
    path: "taskDone.background.opacity",
    group: "Done tasks",
    label: "Background",
    section: "opacity",
    kind: "opacity",
  },
  {
    path: "checkbox.background.opacity",
    group: "Checkbox",
    label: "Background",
    section: "opacity",
    kind: "opacity",
  },
];

/** Every leaf path of a plain style object, in key order. */
export function leafPaths(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child !== null && typeof child === "object" && !Array.isArray(child)
      ? leafPaths(child as Record<string, unknown>, path)
      : [path];
  });
}

/** The value at a dot path. */
export function getAtPath(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], value);
}

/** A copy of `value` with the leaf at `path` replaced; every object on the way is copied. */
export function setAtPath<T>(value: T, path: string, next: unknown): T {
  const [key, ...rest] = path.split(".");
  if (key === undefined) return value;
  const node = value as Record<string, unknown>;
  return {
    ...node,
    [key]: rest.length === 0 ? next : setAtPath(node[key], rest.join("."), next),
  } as T;
}

/** `styles` with every key of `section` set back to its value in `defaults`. */
export function resetSection<T>(
  styles: T,
  defaults: T,
  fields: readonly StyleField<T>[],
  section: StyleSection,
): T {
  return fields
    .filter((field) => field.section === section)
    .reduce((next, field) => setAtPath(next, field.path, getAtPath(defaults, field.path)), styles);
}

/** Whether any key of `section` differs from `defaults` (the reset would change something). */
export function sectionDiffers<T>(
  styles: T,
  defaults: T,
  fields: readonly StyleField<T>[],
  section: StyleSection,
): boolean {
  return fields.some(
    (field) =>
      field.section === section &&
      getAtPath(styles, field.path) !== getAtPath(defaults, field.path),
  );
}
