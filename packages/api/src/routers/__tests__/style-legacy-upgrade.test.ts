import { describe, expect, it } from "vitest";

import type { TaskStyle, TimerStyle } from "@dirework/db";
import {
  LEGACY_TASK_STYLE_VALUES,
  LEGACY_TIMER_STYLE_VALUES,
  TASK_STYLE_COLUMN_DEFAULTS,
  TIMER_STYLE_COLUMN_DEFAULTS,
} from "@dirework/db/defaults";

import {
  buildTaskStylesConfig,
  buildTimerStylesConfig,
  DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_STYLES,
  flattenTaskStyles,
  flattenTimerStyles,
  nestTaskStyleRow,
  nestTimerStyleRow,
  SINGLETON_ID,
  taskStylesInputSchema,
  timerStylesInputSchema,
  upgradeLegacyStyleRow,
} from "../../config-shared";

/** A row exactly as a fresh install's SQL column defaults write it. */
const frozenTimerRow = (): TimerStyle => ({ id: SINGLETON_ID, ...TIMER_STYLE_COLUMN_DEFAULTS });
const frozenTaskRow = (): TaskStyle => ({ id: SINGLETON_ID, ...TASK_STYLE_COLUMN_DEFAULTS });

/** Column keys whose value differs between two flat rows. */
function changedKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return Object.keys(a)
    .filter((key) => a[key] !== b[key])
    .sort();
}

describe("read-time upgrade of never-customized style rows", () => {
  it("a fresh timer_style row reads back as DEFAULT_TIMER_STYLES", () => {
    expect(buildTimerStylesConfig(frozenTimerRow())).toEqual(DEFAULT_TIMER_STYLES);
  });

  it("a fresh task_style row reads back as DEFAULT_TASK_STYLES", () => {
    expect(buildTaskStylesConfig(frozenTaskRow())).toEqual(DEFAULT_TASK_STYLES);
  });

  it("keeps a customized group as stored and still upgrades untouched groups", () => {
    const styles = buildTimerStylesConfig({ ...frozenTimerRow(), ringWidth: 12 });
    expect(styles.ring.width).toBe(12);
    // The rest of the ring group is the owner's too: it stays as stored.
    expect(styles.ring.gap).toBe(TIMER_STYLE_COLUMN_DEFAULTS.ringGap);
    expect(styles.fontSizes.time).toBe("64px");
    expect(styles.fontSizes).toEqual(DEFAULT_TIMER_STYLES.fontSizes);
  });

  it("keeps an old default repeated inside a customized task group (e.g. a 1px border)", () => {
    const styles = buildTaskStylesConfig({ ...frozenTaskRow(), headerBgColor: "#ffffff" });
    expect(styles.header.background.color).toBe("#ffffff");
    expect(styles.header.border.width).toBe(TASK_STYLE_COLUMN_DEFAULTS.headerBorderWidth);
    expect(styles.body).toEqual(DEFAULT_TASK_STYLES.body);
  });

  it("maps every LEGACY_* value to the current default", () => {
    const currentTimer = flattenTimerStyles(DEFAULT_TIMER_STYLES) as Record<string, unknown>;
    for (const [key, values] of Object.entries(LEGACY_TIMER_STYLE_VALUES)) {
      for (const value of values ?? []) {
        const built = flattenTimerStyles(
          buildTimerStylesConfig({ ...frozenTimerRow(), [key]: value }),
        ) as Record<string, unknown>;
        expect(built[key]).toEqual(currentTimer[key]);
      }
    }
    const currentTask = flattenTaskStyles(DEFAULT_TASK_STYLES) as Record<string, unknown>;
    for (const [key, values] of Object.entries(LEGACY_TASK_STYLE_VALUES)) {
      for (const value of values ?? []) {
        const built = flattenTaskStyles(
          buildTaskStylesConfig({ ...frozenTaskRow(), [key]: value }),
        ) as Record<string, unknown>;
        expect(built[key]).toEqual(currentTask[key]);
      }
    }
  });

  it("treats a legacy value like the frozen default (mechanism check)", () => {
    const row = { a: 2, b: "x", c: true };
    const upgraded = upgradeLegacyStyleRow(
      row,
      { a: 1, b: "x", c: true },
      { a: [2] },
      { a: 3, b: "y", c: false },
      [["a", "b"], ["c"]],
    );
    expect(upgraded).toEqual({ a: 3, b: "y", c: false });
    expect(row).toEqual({ a: 2, b: "x", c: true });
  });

  it("frozen column defaults pass the save-path input schemas", () => {
    const timer = timerStylesInputSchema.safeParse(nestTimerStyleRow(frozenTimerRow()));
    expect(timer.success, JSON.stringify(timer.error?.issues)).toBe(true);
    const task = taskStylesInputSchema.safeParse(nestTaskStyleRow(frozenTaskRow()));
    expect(task.success, JSON.stringify(task.error?.issues)).toBe(true);
  });

  it("the timer defaults changed exactly these columns", () => {
    expect(
      changedKeys(flattenTimerStyles(DEFAULT_TIMER_STYLES), TIMER_STYLE_COLUMN_DEFAULTS),
    ).toEqual([
      "bgOpacity",
      "fontSizeCycle",
      "fontSizeLabel",
      "fontSizeTime",
      "ringGap",
      "ringTrackOpacity",
      "ringWidth",
    ]);
  });

  it("the task defaults changed exactly these columns", () => {
    expect(changedKeys(flattenTaskStyles(DEFAULT_TASK_STYLES), TASK_STYLE_COLUMN_DEFAULTS)).toEqual(
      [
        "bodyBgOpacity",
        "bodyBorderRadius",
        "bodyBorderWidth",
        "bodyPaddingHorizontal",
        "bodyPaddingVertical",
        "headerBorderRadius",
        "headerBorderWidth",
        "headerFontSize",
        "headerHeight",
        "headerPadding",
        "taskBorderRadius",
        "taskDoneFontColor",
        "taskFontSize",
        "taskMarginBottom",
        "taskUsernameColor",
      ],
    );
  });

  it("the flat defaults cover every column", () => {
    expect(Object.keys(flattenTimerStyles(DEFAULT_TIMER_STYLES)).sort()).toEqual(
      Object.keys(TIMER_STYLE_COLUMN_DEFAULTS).sort(),
    );
    expect(Object.keys(flattenTaskStyles(DEFAULT_TASK_STYLES)).sort()).toEqual(
      Object.keys(TASK_STYLE_COLUMN_DEFAULTS).sort(),
    );
  });
});
