// Values saved before a limit existed are never migrated: the build* helpers clamp them on
// read, so the overlay draws them inside the range and a whole-group save of what was read
// passes the save schemas.
import { describe, expect, it } from "vitest";

import type { BotConfig, TaskStyle, TimerConfig, TimerStyle } from "@dirework/db";
import { PHASE_LABEL_COLUMN_DEFAULTS, TIMER_CONFIG_DEFAULTS } from "@dirework/db/defaults";

import {
  buildBotConfig,
  buildTaskStylesConfig,
  buildTimerConfig,
  buildTimerStylesConfig,
  CURRENT_TASK_STYLE_ROW,
  CURRENT_TIMER_STYLE_ROW,
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  flattenTaskStyles,
  flattenWithFieldMap,
  PHASE_LABEL_FIELDS,
  SINGLETON_ID,
  TASK_MESSAGE_FIELDS,
  taskStylesInputSchema,
  TIMER_MESSAGE_FIELDS,
  timerStylesInputSchema,
} from "../../config-shared";
import { updateBotSettingsInput, updateStylesInput } from "../input-schemas";

const timerRow = (patch: Partial<TimerStyle>): TimerStyle =>
  ({ id: SINGLETON_ID, ...CURRENT_TIMER_STYLE_ROW, ...patch }) as TimerStyle;
const taskRow = (patch: Partial<TaskStyle>): TaskStyle =>
  ({ id: SINGLETON_ID, ...CURRENT_TASK_STYLE_ROW, ...patch }) as TaskStyle;
const timerConfigRow = (labels: Partial<Record<keyof typeof PHASE_LABEL_FIELDS, string>>) =>
  ({
    id: SINGLETON_ID,
    ...TIMER_CONFIG_DEFAULTS,
    showHours: false,
    ...flattenWithFieldMap(PHASE_LABEL_FIELDS, { ...DEFAULT_PHASE_LABELS, ...labels }),
  }) as unknown as TimerConfig;
const botRow = (patch: Partial<BotConfig>): BotConfig =>
  ({
    id: SINGLETON_ID,
    taskCommandsEnabled: true,
    timerCommandsEnabled: true,
    commandAliases: {},
    muted: false,
    blockedViewers: [],
    ...flattenWithFieldMap(TASK_MESSAGE_FIELDS, DEFAULT_TASK_MESSAGES),
    ...flattenWithFieldMap(TIMER_MESSAGE_FIELDS, DEFAULT_TIMER_MESSAGES),
    ...patch,
  }) as BotConfig;

describe("style rows clamp on read", () => {
  it("timer: out-of-range lengths and ring numbers move to the nearest bound", () => {
    const styles = buildTimerStylesConfig(
      timerRow({
        fontSizeTime: "400px",
        fontSizeLabel: "-2px",
        textOutlineSize: "20px",
        width: "50px",
        ringWidth: 120,
        ringGap: -5,
      }),
    );
    expect(styles.fontSizes.time).toBe("160px");
    expect(styles.fontSizes.label).toBe("14px");
    expect(styles.text.outlineSize).toBe("6px");
    expect(styles.dimensions.width).toBe("120px");
    expect(styles.ring.width).toBe(40);
    expect(styles.ring.gap).toBe(0);
  });

  it("timer: a unit the field no longer takes falls back to the default", () => {
    const styles = buildTimerStylesConfig(timerRow({ fontSizeTime: "50%", height: "auto" }));
    expect(styles.fontSizes.time).toBe("64px");
    expect(styles.dimensions.height).toBe("300px");
  });

  it("task: lengths, shorthands, scroll numbers and old glyphs read back inside the limits", () => {
    const styles = buildTaskStylesConfig(
      taskRow({
        taskFontSize: "120px",
        taskPadding: "-4px 80px",
        checkboxMarginTop: "-10px",
        headerBorderWidth: "30px",
        scrollPixelsPerSecond: 900,
        scrollGapBetweenLoops: 4000,
        checkboxTickChar: "✓",
        bulletChar: "<x>",
      }),
    );
    expect(styles.task.fontSize).toBe("64px");
    expect(styles.task.padding).toBe("0px 48px");
    expect(styles.checkbox.margin.top).toBe("0px");
    expect(styles.header.border.width).toBe("12px");
    expect(styles.scroll.pixelsPerSecond).toBe(200);
    expect(styles.scroll.gapBetweenLoops).toBe(300);
    expect(styles.checkbox.tickIcon).toBe("check");
    expect(styles.bullet.icon).toBe("dot");
  });

  it("a whole Theme Center save of what was read passes the save schema", () => {
    const timerStyles = buildTimerStylesConfig(
      timerRow({ fontSizeTime: "999px", width: "10vw", ringWidth: 300, bgBorderRadius: "-1px" }),
    );
    const taskStyles = buildTaskStylesConfig(
      taskRow({ taskMaxWidth: "5000px", bodyPaddingVertical: "auto", bulletChar: "→→" }),
    );
    const { labels: phaseLabels } = buildTimerConfig(
      timerConfigRow({ work: "A very long focus label indeed" }),
    );
    expect(updateStylesInput.safeParse({ timerStyles, taskStyles, phaseLabels }).success).toBe(
      true,
    );
  });

  // Shorthands the old allowlist took: every part is checked for a readable unit BEFORE any
  // part is clamped, so an out-of-range first part never hides a later one in a unit the
  // field no longer takes (which used to crash the read).
  it.each([
    // [column, stored, read back]
    ["taskPadding", "80px 10%", "10px 14px"],
    ["taskPadding", "10% 80px", "10px 14px"],
    ["taskPadding", "-4px 2rem 60px", "0px 2rem 48px"],
    ["taskPadding", "-1px -2px -3px -4px", "0px 0px 0px 0px"],
    ["taskPadding", "4px 8px 12px 16px", "4px 8px 12px 16px"],
    ["taskPadding", "80px auto", "10px 14px"],
    ["taskPadding", "1px 2px 3px 4px 5px", "10px 14px"],
    ["headerPadding", "100px 1ch", "12px 18px"],
    ["taskBorderRadius", "80px 60% -2px 4px", "64px 50% 0px 4px"],
    ["headerBorderRadius", "99px 99px 2vw 0", "14px 14px 0 0"],
    ["bodyBorderRadius", "0 0 5rem 5rem", "0 0 64px 64px"],
  ] as const)("task %s %j reads back as %j, and saves", (column, stored, expected) => {
    const taskStyles = buildTaskStylesConfig(taskRow({ [column]: stored }));
    expect(flattenTaskStyles(taskStyles)[column]).toBe(expected);
    expect(taskStylesInputSchema.safeParse(taskStyles).success).toBe(true);
  });

  it.each([
    ["bgBorderRadius", "700px 10vw"],
    ["bgBorderRadius", "-5% 700px 20% 1pt"],
    ["width", "5000pt"],
    ["fontSizeLabel", "1px 2px"],
  ] as const)("timer %s %j reads back saveable", (column, stored) => {
    const timerStyles = buildTimerStylesConfig(timerRow({ [column]: stored }));
    expect(timerStylesInputSchema.safeParse(timerStyles).success).toBe(true);
  });

  it("a row already inside every limit reads back unchanged", () => {
    const row = timerRow({ fontSizeTime: "2.5rem", width: "40vw" });
    const styles = buildTimerStylesConfig(row);
    expect(styles.fontSizes.time).toBe("2.5rem");
    expect(styles.dimensions.width).toBe("40vw");
  });
});

describe("phase labels read", () => {
  it("the frozen 18-character starting default reads back as the current default", () => {
    const { labels } = buildTimerConfig(
      timerConfigRow({ starting: PHASE_LABEL_COLUMN_DEFAULTS.starting }),
    );
    expect(labels.starting).toBe(DEFAULT_PHASE_LABELS.starting);
  });

  it("a custom label over the cap is cut to it; a fitting one is untouched", () => {
    const { labels } = buildTimerConfig(
      timerConfigRow({ work: "Deep work: writing the thesis", break: "Snack" }),
    );
    expect(labels.work).toBe("Deep work: writi");
    expect(labels.break).toBe("Snack");
  });
});

describe("bot settings read", () => {
  it("templates lose placeholders past the fourth use, and the result saves", () => {
    const config = buildBotConfig(
      botRow({ msgTaskDone: "{user} {user} {user} {user} {user} done {task}" }),
    );
    expect(config.task.taskDone).toBe("{user} {user} {user} {user}  done {task}");
    expect(updateBotSettingsInput.safeParse({ task: config.task }).success).toBe(true);
  });

  it("aliases the save rules reject are dropped; the rest resolve and save", () => {
    const config = buildBotConfig(
      botRow({ commandAliases: { t: "task", ["x".repeat(30)]: "done", d: "y".repeat(40) } }),
    );
    expect(config.commandAliases).toEqual({ t: "task" });
    expect(
      updateBotSettingsInput.safeParse({ commandAliases: config.commandAliases }).success,
    ).toBe(true);
  });
});
