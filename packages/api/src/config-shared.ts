// ── Pure shared config module ────────────────────────────────────────────────
// NO runtime imports of @dirework/env or @dirework/auth — this module is
// imported by Vitest (node) and by apps/web, neither of which can resolve
// cloudflare:workers. The only runtime deps are zod and the (env-free)
// @dirework/db schema/defaults modules. Type-only imports are erased and
// therefore safe.
import { z } from "zod";

import type { BotConfig, TaskStyle, TimerConfig, TimerStyle } from "@dirework/db";
import {
  DEFAULT_PHASE_LABELS as DB_DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES as DB_DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES as DB_DEFAULT_TIMER_MESSAGES,
  TIMER_CONFIG_DEFAULTS as DB_TIMER_CONFIG_DEFAULTS,
} from "@dirework/db/defaults";

/** Singleton-row primary key used by every one-row config table (single source: packages/db schema). */
export { SINGLETON_ID } from "@dirework/db/schema";

/** Maximum task text length — enforced by tRPC input schemas AND the chat path. */
export const MAX_TASK_LEN = 500;

/** Per-user open (pending+active) task cap enforced on the chat ingest path. */
export const CHAT_OPEN_TASK_CAP = 20;

/** Every timer state-machine status — single source for status literals. */
export const TIMER_STATUSES = [
  "idle",
  "starting",
  "work",
  "break",
  "longBreak",
  "paused",
  "finished",
] as const;

export type TimerStatus = (typeof TIMER_STATUSES)[number];

// ── Field maps: nested config keys ↔ flat DB columns (single source) ─────────
// Build and flatten are both generated from these maps, so they cannot drift.

export const PHASE_LABEL_FIELDS = {
  idle: "labelIdle",
  starting: "labelStarting",
  work: "labelWork",
  break: "labelBreak",
  longBreak: "labelLongBreak",
  paused: "labelPaused",
  finished: "labelFinished",
} as const satisfies Record<TimerStatus, keyof TimerConfig>;

export const TASK_MESSAGE_FIELDS = {
  taskAdded: "msgTaskAdded",
  noTaskAdded: "msgNoTaskAdded",
  noTaskContent: "msgNoTaskContent",
  noTaskToEdit: "msgNoTaskToEdit",
  taskEdited: "msgTaskEdited",
  taskRemoved: "msgTaskRemoved",
  taskNext: "msgTaskNext",
  adminDeleteTasks: "msgAdminDeleteTasks",
  taskDone: "msgTaskDone",
  taskCheck: "msgTaskCheck",
  taskCheckUser: "msgTaskCheckUser",
  noTask: "msgNoTask",
  noTaskOther: "msgNoTaskOther",
  notMod: "msgNotMod",
  clearedAll: "msgClearedAll",
  clearedDone: "msgClearedDone",
  nextNoContent: "msgNextNoContent",
  help: "msgHelp",
} as const satisfies Record<string, keyof BotConfig>;

export const TIMER_MESSAGE_FIELDS = {
  workMsg: "msgWorkMsg",
  breakMsg: "msgBreakMsg",
  longBreakMsg: "msgLongBreakMsg",
  workRemindMsg: "msgWorkRemindMsg",
  notRunning: "msgNotRunning",
  streamStarting: "msgStreamStarting",
  wrongCommand: "msgWrongCommand",
  timerRunning: "msgTimerRunning",
  commandSuccess: "msgCommandSuccess",
  cycleWrong: "msgCycleWrong",
  goalWrong: "msgGoalWrong",
  finishResponse: "msgFinishResponse",
  alreadyStarting: "msgAlreadyStarting",
  eta: "msgEta",
} as const satisfies Record<string, keyof BotConfig>;

/** Nested config object (field-map keys) from a flat DB row (field-map columns). */
export function buildFromFieldMap<M extends Record<string, string>>(
  map: M,
  row: Record<M[keyof M], string>,
): Record<keyof M, string> {
  const out = {} as Record<keyof M, string>;
  for (const key of Object.keys(map) as (keyof M & string)[]) {
    out[key] = row[map[key] as M[keyof M]];
  }
  return out;
}

/** Flat DB column patch (field-map columns) from a nested config object (field-map keys). */
export function flattenWithFieldMap<M extends Record<string, string>>(
  map: M,
  values: Record<keyof M, string>,
): Record<M[keyof M], string> {
  const out = {} as Record<M[keyof M], string>;
  for (const key of Object.keys(map) as (keyof M & string)[]) {
    out[map[key] as M[keyof M]] = values[key];
  }
  return out;
}

/** z.object with a z.string() per field-map key — router inputs derive from the same maps. */
function stringSchemaFromFieldMap<M extends Record<string, string>>(map: M) {
  const shape = Object.fromEntries(
    Object.keys(map).map((key) => [key, z.string()]),
  ) as Record<keyof M & string, z.ZodString>;
  return z.object(shape);
}

export const phaseLabelsInputSchema = stringSchemaFromFieldMap(PHASE_LABEL_FIELDS);
export const taskMessagesInputSchema = stringSchemaFromFieldMap(TASK_MESSAGE_FIELDS);
export const timerMessagesInputSchema = stringSchemaFromFieldMap(TIMER_MESSAGE_FIELDS);

// ── Shared config types (single source of truth — apps/web imports these) ────

export type PhaseLabelsConfig = Record<keyof typeof PHASE_LABEL_FIELDS, string>;
export type TaskMessagesConfig = Record<keyof typeof TASK_MESSAGE_FIELDS, string>;
export type TimerMessagesConfig = Record<keyof typeof TIMER_MESSAGE_FIELDS, string>;

export interface BotConfigData {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  commandAliases: Record<string, string>;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

// Default values live in @dirework/db/defaults (the same objects back the
// schema column defaults); the typed re-exports below guarantee they stay in
// shape-lockstep with the field maps.

export const DEFAULT_PHASE_LABELS: PhaseLabelsConfig = DB_DEFAULT_PHASE_LABELS;
export const DEFAULT_TASK_MESSAGES: TaskMessagesConfig = DB_DEFAULT_TASK_MESSAGES;
export const DEFAULT_TIMER_MESSAGES: TimerMessagesConfig = DB_DEFAULT_TIMER_MESSAGES;

/** Canonical timer duration/cycle defaults — single source for the dashboard
 * controls, the overlay/preview progress fallbacks, and the schema columns. */
export const TIMER_CONFIG_DEFAULTS = DB_TIMER_CONFIG_DEFAULTS;

// ── Build helpers: flat DB rows → nested frontend objects ─────────────────────

export function buildTimerStylesConfig(s: TimerStyle) {
  return {
    dimensions: { width: s.width, height: s.height },
    background: { color: s.bgColor, opacity: s.bgOpacity, borderRadius: s.bgBorderRadius },
    ring: {
      enabled: s.ringEnabled,
      trackColor: s.ringTrackColor,
      trackOpacity: s.ringTrackOpacity,
      fillColor: s.ringFillColor,
      fillOpacity: s.ringFillOpacity,
      width: s.ringWidth,
      gap: s.ringGap,
    },
    text: {
      color: s.textColor,
      outlineColor: s.textOutlineColor,
      outlineSize: s.textOutlineSize,
      fontFamily: s.textFontFamily,
    },
    fontSizes: { label: s.fontSizeLabel, time: s.fontSizeTime, cycle: s.fontSizeCycle },
  };
}

export type TimerStylesConfig = ReturnType<typeof buildTimerStylesConfig>;

export function buildTaskStylesConfig(s: TaskStyle) {
  return {
    display: {
      showDone: s.displayShowDone,
      showCount: s.displayShowCount,
      useCheckboxes: s.displayUseCheckboxes,
      crossOnDone: s.displayCrossOnDone,
      numberOfLines: s.displayNumberOfLines,
    },
    fonts: { header: s.fontHeader, body: s.fontBody },
    scroll: {
      enabled: s.scrollEnabled,
      pixelsPerSecond: s.scrollPixelsPerSecond,
      gapBetweenLoops: s.scrollGapBetweenLoops,
    },
    header: {
      height: s.headerHeight,
      background: { color: s.headerBgColor, opacity: s.headerBgOpacity },
      border: { color: s.headerBorderColor, width: s.headerBorderWidth, radius: s.headerBorderRadius },
      fontSize: s.headerFontSize,
      fontColor: s.headerFontColor,
      padding: s.headerPadding,
    },
    body: {
      background: { color: s.bodyBgColor, opacity: s.bodyBgOpacity },
      border: { color: s.bodyBorderColor, width: s.bodyBorderWidth, radius: s.bodyBorderRadius },
      padding: { vertical: s.bodyPaddingVertical, horizontal: s.bodyPaddingHorizontal },
    },
    task: {
      background: { color: s.taskBgColor, opacity: s.taskBgOpacity },
      border: { color: s.taskBorderColor, width: s.taskBorderWidth, radius: s.taskBorderRadius },
      fontSize: s.taskFontSize,
      fontColor: s.taskFontColor,
      usernameColor: s.taskUsernameColor,
      padding: s.taskPadding,
      marginBottom: s.taskMarginBottom,
      maxWidth: s.taskMaxWidth,
    },
    taskDone: {
      background: { color: s.taskDoneBgColor, opacity: s.taskDoneBgOpacity },
      fontColor: s.taskDoneFontColor,
    },
    checkbox: {
      size: s.checkboxSize,
      background: { color: s.checkboxBgColor, opacity: s.checkboxBgOpacity },
      border: { color: s.checkboxBorderColor, width: s.checkboxBorderWidth, radius: s.checkboxBorderRadius },
      margin: { top: s.checkboxMarginTop, left: s.checkboxMarginLeft, right: s.checkboxMarginRight },
      tickChar: s.checkboxTickChar,
      tickSize: s.checkboxTickSize,
      tickColor: s.checkboxTickColor,
    },
    bullet: {
      char: s.bulletChar,
      size: s.bulletSize,
      color: s.bulletColor,
      margin: { top: s.bulletMarginTop, left: s.bulletMarginLeft, right: s.bulletMarginRight },
    },
  };
}

export type TaskStylesConfig = ReturnType<typeof buildTaskStylesConfig>;

export function buildTimerConfig(tc: TimerConfig) {
  return {
    workDuration: tc.workDuration,
    breakDuration: tc.breakDuration,
    longBreakDuration: tc.longBreakDuration,
    longBreakInterval: tc.longBreakInterval,
    startingDuration: tc.startingDuration,
    defaultCycles: tc.defaultCycles,
    showHours: tc.showHours,
    noLastBreak: tc.noLastBreak,
    labels: buildFromFieldMap(PHASE_LABEL_FIELDS, tc) satisfies PhaseLabelsConfig,
  };
}

export type TimerConfigData = ReturnType<typeof buildTimerConfig>;

export function buildBotConfig(bc: BotConfig): BotConfigData {
  return {
    taskCommandsEnabled: bc.taskCommandsEnabled,
    timerCommandsEnabled: bc.timerCommandsEnabled,
    commandAliases: bc.commandAliases as Record<string, string>,
    task: buildFromFieldMap(TASK_MESSAGE_FIELDS, bc),
    timer: buildFromFieldMap(TIMER_MESSAGE_FIELDS, bc),
  };
}

// ── Style input schemas + flatten: nested objects → flat DB columns ──────────
// The zod schemas are the single source; the TS input types are z.infer'd from
// them (the router and the TS interfaces used to duplicate these shapes).
// Every level is optional to mirror the partial-update flatten behavior.

export const timerStylesInputSchema = z.object({
  dimensions: z.object({ width: z.string().optional(), height: z.string().optional() }).optional(),
  background: z.object({
    color: z.string().optional(),
    opacity: z.number().optional(),
    borderRadius: z.string().optional(),
  }).optional(),
  ring: z.object({
    enabled: z.boolean().optional(),
    trackColor: z.string().optional(),
    trackOpacity: z.number().optional(),
    fillColor: z.string().optional(),
    fillOpacity: z.number().optional(),
    width: z.number().optional(),
    gap: z.number().optional(),
  }).optional(),
  text: z.object({
    color: z.string().optional(),
    outlineColor: z.string().optional(),
    outlineSize: z.string().optional(),
    fontFamily: z.string().optional(),
  }).optional(),
  fontSizes: z.object({
    label: z.string().optional(),
    time: z.string().optional(),
    cycle: z.string().optional(),
  }).optional(),
});

export type TimerStylesInput = z.infer<typeof timerStylesInputSchema>;

export function flattenTimerStyles(input: TimerStylesInput) {
  return {
    ...(input.dimensions?.width != null && { width: input.dimensions.width }),
    ...(input.dimensions?.height != null && { height: input.dimensions.height }),
    ...(input.background?.color != null && { bgColor: input.background.color }),
    ...(input.background?.opacity != null && { bgOpacity: input.background.opacity }),
    ...(input.background?.borderRadius != null && { bgBorderRadius: input.background.borderRadius }),
    ...(input.ring?.enabled != null && { ringEnabled: input.ring.enabled }),
    ...(input.ring?.trackColor != null && { ringTrackColor: input.ring.trackColor }),
    ...(input.ring?.trackOpacity != null && { ringTrackOpacity: input.ring.trackOpacity }),
    ...(input.ring?.fillColor != null && { ringFillColor: input.ring.fillColor }),
    ...(input.ring?.fillOpacity != null && { ringFillOpacity: input.ring.fillOpacity }),
    ...(input.ring?.width != null && { ringWidth: input.ring.width }),
    ...(input.ring?.gap != null && { ringGap: input.ring.gap }),
    ...(input.text?.color != null && { textColor: input.text.color }),
    ...(input.text?.outlineColor != null && { textOutlineColor: input.text.outlineColor }),
    ...(input.text?.outlineSize != null && { textOutlineSize: input.text.outlineSize }),
    ...(input.text?.fontFamily != null && { textFontFamily: input.text.fontFamily }),
    ...(input.fontSizes?.label != null && { fontSizeLabel: input.fontSizes.label }),
    ...(input.fontSizes?.time != null && { fontSizeTime: input.fontSizes.time }),
    ...(input.fontSizes?.cycle != null && { fontSizeCycle: input.fontSizes.cycle }),
  };
}

const opacityGroupSchema = z.object({
  color: z.string().optional(),
  opacity: z.number().optional(),
});

const borderGroupSchema = z.object({
  color: z.string().optional(),
  width: z.string().optional(),
  radius: z.string().optional(),
});

const marginGroupSchema = z.object({
  top: z.string().optional(),
  left: z.string().optional(),
  right: z.string().optional(),
});

export const taskStylesInputSchema = z.object({
  display: z.object({
    showDone: z.boolean().optional(),
    showCount: z.boolean().optional(),
    useCheckboxes: z.boolean().optional(),
    crossOnDone: z.boolean().optional(),
    numberOfLines: z.number().optional(),
  }).optional(),
  fonts: z.object({ header: z.string().optional(), body: z.string().optional() }).optional(),
  scroll: z.object({
    enabled: z.boolean().optional(),
    pixelsPerSecond: z.number().optional(),
    gapBetweenLoops: z.number().optional(),
  }).optional(),
  header: z.object({
    height: z.string().optional(),
    background: opacityGroupSchema.optional(),
    border: borderGroupSchema.optional(),
    fontSize: z.string().optional(),
    fontColor: z.string().optional(),
    padding: z.string().optional(),
  }).optional(),
  body: z.object({
    background: opacityGroupSchema.optional(),
    border: borderGroupSchema.optional(),
    padding: z.object({ vertical: z.string().optional(), horizontal: z.string().optional() }).optional(),
  }).optional(),
  task: z.object({
    background: opacityGroupSchema.optional(),
    border: borderGroupSchema.optional(),
    fontSize: z.string().optional(),
    fontColor: z.string().optional(),
    usernameColor: z.string().optional(),
    padding: z.string().optional(),
    marginBottom: z.string().optional(),
    maxWidth: z.string().optional(),
  }).optional(),
  taskDone: z.object({
    background: opacityGroupSchema.optional(),
    fontColor: z.string().optional(),
  }).optional(),
  checkbox: z.object({
    size: z.string().optional(),
    background: opacityGroupSchema.optional(),
    border: borderGroupSchema.optional(),
    margin: marginGroupSchema.optional(),
    tickChar: z.string().optional(),
    tickSize: z.string().optional(),
    tickColor: z.string().optional(),
  }).optional(),
  bullet: z.object({
    char: z.string().optional(),
    size: z.string().optional(),
    color: z.string().optional(),
    margin: marginGroupSchema.optional(),
  }).optional(),
});

export type TaskStylesInput = z.infer<typeof taskStylesInputSchema>;

export function flattenTaskStyles(input: TaskStylesInput) {
  return {
    ...(input.display?.showDone != null && { displayShowDone: input.display.showDone }),
    ...(input.display?.showCount != null && { displayShowCount: input.display.showCount }),
    ...(input.display?.useCheckboxes != null && { displayUseCheckboxes: input.display.useCheckboxes }),
    ...(input.display?.crossOnDone != null && { displayCrossOnDone: input.display.crossOnDone }),
    ...(input.display?.numberOfLines != null && { displayNumberOfLines: input.display.numberOfLines }),
    ...(input.fonts?.header != null && { fontHeader: input.fonts.header }),
    ...(input.fonts?.body != null && { fontBody: input.fonts.body }),
    ...(input.scroll?.enabled != null && { scrollEnabled: input.scroll.enabled }),
    ...(input.scroll?.pixelsPerSecond != null && { scrollPixelsPerSecond: input.scroll.pixelsPerSecond }),
    ...(input.scroll?.gapBetweenLoops != null && { scrollGapBetweenLoops: input.scroll.gapBetweenLoops }),
    ...(input.header?.height != null && { headerHeight: input.header.height }),
    ...(input.header?.background?.color != null && { headerBgColor: input.header.background.color }),
    ...(input.header?.background?.opacity != null && { headerBgOpacity: input.header.background.opacity }),
    ...(input.header?.border?.color != null && { headerBorderColor: input.header.border.color }),
    ...(input.header?.border?.width != null && { headerBorderWidth: input.header.border.width }),
    ...(input.header?.border?.radius != null && { headerBorderRadius: input.header.border.radius }),
    ...(input.header?.fontSize != null && { headerFontSize: input.header.fontSize }),
    ...(input.header?.fontColor != null && { headerFontColor: input.header.fontColor }),
    ...(input.header?.padding != null && { headerPadding: input.header.padding }),
    ...(input.body?.background?.color != null && { bodyBgColor: input.body.background.color }),
    ...(input.body?.background?.opacity != null && { bodyBgOpacity: input.body.background.opacity }),
    ...(input.body?.border?.color != null && { bodyBorderColor: input.body.border.color }),
    ...(input.body?.border?.width != null && { bodyBorderWidth: input.body.border.width }),
    ...(input.body?.border?.radius != null && { bodyBorderRadius: input.body.border.radius }),
    ...(input.body?.padding?.vertical != null && { bodyPaddingVertical: input.body.padding.vertical }),
    ...(input.body?.padding?.horizontal != null && { bodyPaddingHorizontal: input.body.padding.horizontal }),
    ...(input.task?.background?.color != null && { taskBgColor: input.task.background.color }),
    ...(input.task?.background?.opacity != null && { taskBgOpacity: input.task.background.opacity }),
    ...(input.task?.border?.color != null && { taskBorderColor: input.task.border.color }),
    ...(input.task?.border?.width != null && { taskBorderWidth: input.task.border.width }),
    ...(input.task?.border?.radius != null && { taskBorderRadius: input.task.border.radius }),
    ...(input.task?.fontSize != null && { taskFontSize: input.task.fontSize }),
    ...(input.task?.fontColor != null && { taskFontColor: input.task.fontColor }),
    ...(input.task?.usernameColor != null && { taskUsernameColor: input.task.usernameColor }),
    ...(input.task?.padding != null && { taskPadding: input.task.padding }),
    ...(input.task?.marginBottom != null && { taskMarginBottom: input.task.marginBottom }),
    ...(input.task?.maxWidth != null && { taskMaxWidth: input.task.maxWidth }),
    ...(input.taskDone?.background?.color != null && { taskDoneBgColor: input.taskDone.background.color }),
    ...(input.taskDone?.background?.opacity != null && { taskDoneBgOpacity: input.taskDone.background.opacity }),
    ...(input.taskDone?.fontColor != null && { taskDoneFontColor: input.taskDone.fontColor }),
    ...(input.checkbox?.size != null && { checkboxSize: input.checkbox.size }),
    ...(input.checkbox?.background?.color != null && { checkboxBgColor: input.checkbox.background.color }),
    ...(input.checkbox?.background?.opacity != null && { checkboxBgOpacity: input.checkbox.background.opacity }),
    ...(input.checkbox?.border?.color != null && { checkboxBorderColor: input.checkbox.border.color }),
    ...(input.checkbox?.border?.width != null && { checkboxBorderWidth: input.checkbox.border.width }),
    ...(input.checkbox?.border?.radius != null && { checkboxBorderRadius: input.checkbox.border.radius }),
    ...(input.checkbox?.margin?.top != null && { checkboxMarginTop: input.checkbox.margin.top }),
    ...(input.checkbox?.margin?.left != null && { checkboxMarginLeft: input.checkbox.margin.left }),
    ...(input.checkbox?.margin?.right != null && { checkboxMarginRight: input.checkbox.margin.right }),
    ...(input.checkbox?.tickChar != null && { checkboxTickChar: input.checkbox.tickChar }),
    ...(input.checkbox?.tickSize != null && { checkboxTickSize: input.checkbox.tickSize }),
    ...(input.checkbox?.tickColor != null && { checkboxTickColor: input.checkbox.tickColor }),
    ...(input.bullet?.char != null && { bulletChar: input.bullet.char }),
    ...(input.bullet?.size != null && { bulletSize: input.bullet.size }),
    ...(input.bullet?.color != null && { bulletColor: input.bullet.color }),
    ...(input.bullet?.margin?.top != null && { bulletMarginTop: input.bullet.margin.top }),
    ...(input.bullet?.margin?.left != null && { bulletMarginLeft: input.bullet.margin.left }),
    ...(input.bullet?.margin?.right != null && { bulletMarginRight: input.bullet.margin.right }),
  };
}
