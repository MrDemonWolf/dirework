// ── Pure shared config module ────────────────────────────────────────────────
// NO runtime imports of @dirework/env, @dirework/db, or @dirework/auth — this
// module is imported by Vitest (node) and by apps/web, neither of which can
// resolve cloudflare:workers. Type-only imports are erased and therefore safe.
import type { BotConfig, TaskStyle, TimerConfig, TimerStyle } from "@dirework/db";

/** Singleton-row primary key used by every one-row config table. */
export const SINGLETON_ID = "singleton";

/** Maximum task text length — enforced by tRPC input schemas AND the chat path. */
export const MAX_TASK_LEN = 500;

/** Per-user open (pending+active) task cap enforced on the chat ingest path. */
export const CHAT_OPEN_TASK_CAP = 20;

// ── Shared config types (single source of truth — apps/web imports these) ────

export interface PhaseLabelsConfig {
  idle: string;
  starting: string;
  work: string;
  break: string;
  longBreak: string;
  paused: string;
  finished: string;
}

export interface TaskMessagesConfig {
  taskAdded: string;
  noTaskAdded: string;
  noTaskContent: string;
  noTaskToEdit: string;
  taskEdited: string;
  taskRemoved: string;
  taskNext: string;
  adminDeleteTasks: string;
  taskDone: string;
  taskCheck: string;
  taskCheckUser: string;
  noTask: string;
  noTaskOther: string;
  notMod: string;
  clearedAll: string;
  clearedDone: string;
  nextNoContent: string;
  help: string;
}

export interface TimerMessagesConfig {
  workMsg: string;
  breakMsg: string;
  longBreakMsg: string;
  workRemindMsg: string;
  notRunning: string;
  streamStarting: string;
  wrongCommand: string;
  timerRunning: string;
  commandSuccess: string;
  cycleWrong: string;
  goalWrong: string;
  finishResponse: string;
  alreadyStarting: string;
  eta: string;
}

export interface BotConfigData {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  commandAliases: Record<string, string>;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

/** Default phase labels — mirror the schema column defaults. */
export const DEFAULT_PHASE_LABELS: PhaseLabelsConfig = {
  idle: "Resting",
  starting: "Gathering the Pack",
  work: "On the Hunt",
  break: "Den Rest",
  longBreak: "Pack Slumber",
  paused: "Paws'd",
  finished: "Hunt Complete",
};

/** Default task chat messages — mirror the botConfig schema column defaults. */
export const DEFAULT_TASK_MESSAGES: TaskMessagesConfig = {
  taskAdded: 'Awooo! The task "{task}" has been added to the pack, {user}!',
  noTaskAdded: "You're already on the hunt {user}, use !check to see your current task!",
  noTaskContent: "Tell the pack what you're working on! Use !task [task] {user}",
  noTaskToEdit: "No task found in your den to edit {user}",
  taskEdited: 'The hunt has changed! Task updated to "{task}" {user}',
  taskRemoved: 'Task "{task}" has been scent-wiped from the list, {user}',
  taskNext: "Paws-ome work finishing '{oldTask}'! Now tracking '{newTask}', {user}!",
  adminDeleteTasks: "All of the user's tasks have been cleared from the forest.",
  taskDone: 'Alpha work! You finished "{task}" {user}!',
  taskCheck: '{user}, your current scent is on: "{task}"',
  taskCheckUser: '{user}, {user2} is currently tracking: "{task}"',
  noTask: "Looks like you aren't tracking anything in the forest right now, {user}",
  noTaskOther: "The scent is cold... there is no task from that user {user}",
  notMod: "Grrr! Permission denied, {user}; Only pack leaders (mods) can do that.",
  clearedAll: "The forest has been cleared of all tasks!",
  clearedDone: "All finished tasks have been cleared from the den!",
  nextNoContent: "Don't leave the pack hanging! Try !next [task] {user}",
  help: "{user} Join the hunt with !task, !remove, !edit, or !done.",
};

/** Default timer chat messages — mirror the botConfig schema column defaults. */
export const DEFAULT_TIMER_MESSAGES: TimerMessagesConfig = {
  workMsg: "Time to hunt some code! Focus mode activated!",
  breakMsg: "Paws up! Time for a short rest in the den.",
  longBreakMsg: "The whole pack is taking a long snooze! Back soon!",
  workRemindMsg: "Get ready to howl at that code @{channel}, focus starts in 25 seconds!",
  notRunning: "The timer isn't howling yet! Start it up first.",
  streamStarting: "The Blue Wolf is waking up! Stream starting!",
  wrongCommand: "My ears didn't catch that... Command not recognized!",
  timerRunning: "The hunt is already in progress!",
  commandSuccess: "Paw-fect! Done!",
  cycleWrong: "The cycle cannot outrun the goal!",
  goalWrong: "The goal needs to be further than the cycle!",
  finishResponse: "Great work today pack! We hunted well.",
  alreadyStarting: "The pack is already moving or the timer is running!",
  eta: "The hunt will end at {time}",
};

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
    labels: {
      idle: tc.labelIdle,
      starting: tc.labelStarting,
      work: tc.labelWork,
      break: tc.labelBreak,
      longBreak: tc.labelLongBreak,
      paused: tc.labelPaused,
      finished: tc.labelFinished,
    } satisfies PhaseLabelsConfig,
  };
}

export type TimerConfigData = ReturnType<typeof buildTimerConfig>;

export function buildBotConfig(bc: BotConfig): BotConfigData {
  return {
    taskCommandsEnabled: bc.taskCommandsEnabled,
    timerCommandsEnabled: bc.timerCommandsEnabled,
    commandAliases: bc.commandAliases as Record<string, string>,
    task: {
      taskAdded: bc.msgTaskAdded,
      noTaskAdded: bc.msgNoTaskAdded,
      noTaskContent: bc.msgNoTaskContent,
      noTaskToEdit: bc.msgNoTaskToEdit,
      taskEdited: bc.msgTaskEdited,
      taskRemoved: bc.msgTaskRemoved,
      taskNext: bc.msgTaskNext,
      adminDeleteTasks: bc.msgAdminDeleteTasks,
      taskDone: bc.msgTaskDone,
      taskCheck: bc.msgTaskCheck,
      taskCheckUser: bc.msgTaskCheckUser,
      noTask: bc.msgNoTask,
      noTaskOther: bc.msgNoTaskOther,
      notMod: bc.msgNotMod,
      clearedAll: bc.msgClearedAll,
      clearedDone: bc.msgClearedDone,
      nextNoContent: bc.msgNextNoContent,
      help: bc.msgHelp,
    },
    timer: {
      workMsg: bc.msgWorkMsg,
      breakMsg: bc.msgBreakMsg,
      longBreakMsg: bc.msgLongBreakMsg,
      workRemindMsg: bc.msgWorkRemindMsg,
      notRunning: bc.msgNotRunning,
      streamStarting: bc.msgStreamStarting,
      wrongCommand: bc.msgWrongCommand,
      timerRunning: bc.msgTimerRunning,
      commandSuccess: bc.msgCommandSuccess,
      cycleWrong: bc.msgCycleWrong,
      goalWrong: bc.msgGoalWrong,
      finishResponse: bc.msgFinishResponse,
      alreadyStarting: bc.msgAlreadyStarting,
      eta: bc.msgEta,
    },
  };
}

// ── Flatten helpers: nested frontend objects → flat DB columns ─────────────────

export interface TimerStylesInput {
  dimensions?: { width?: string; height?: string };
  background?: { color?: string; opacity?: number; borderRadius?: string };
  ring?: {
    enabled?: boolean;
    trackColor?: string;
    trackOpacity?: number;
    fillColor?: string;
    fillOpacity?: number;
    width?: number;
    gap?: number;
  };
  text?: { color?: string; outlineColor?: string; outlineSize?: string; fontFamily?: string };
  fontSizes?: { label?: string; time?: string; cycle?: string };
}

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

export interface TaskStylesInput {
  display?: { showDone?: boolean; showCount?: boolean; useCheckboxes?: boolean; crossOnDone?: boolean; numberOfLines?: number };
  fonts?: { header?: string; body?: string };
  scroll?: { enabled?: boolean; pixelsPerSecond?: number; gapBetweenLoops?: number };
  header?: { height?: string; background?: { color?: string; opacity?: number }; border?: { color?: string; width?: string; radius?: string }; fontSize?: string; fontColor?: string; padding?: string };
  body?: { background?: { color?: string; opacity?: number }; border?: { color?: string; width?: string; radius?: string }; padding?: { vertical?: string; horizontal?: string } };
  task?: { background?: { color?: string; opacity?: number }; border?: { color?: string; width?: string; radius?: string }; fontSize?: string; fontColor?: string; usernameColor?: string; padding?: string; marginBottom?: string; maxWidth?: string };
  taskDone?: { background?: { color?: string; opacity?: number }; fontColor?: string };
  checkbox?: { size?: string; background?: { color?: string; opacity?: number }; border?: { color?: string; width?: string; radius?: string }; margin?: { top?: string; left?: string; right?: string }; tickChar?: string; tickSize?: string; tickColor?: string };
  bullet?: { char?: string; size?: string; color?: string; margin?: { top?: string; left?: string; right?: string } };
}

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
