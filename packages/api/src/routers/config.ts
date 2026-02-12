import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { ee } from "../events";
import type { TimerConfig, TimerStyle, TaskStyle, BotConfig } from "@dirework/db";

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
    },
  };
}

export function buildBotConfig(bc: BotConfig) {
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

interface TimerStylesInput {
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

interface TaskStylesInput {
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

// ── Provisioning helper ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUserConfig(prisma: any, userId: string) {
  // Upsert is atomic — no race conditions, 1 round-trip per model (all parallel)
  const [timerConfig, timerStyle, taskStyle, botConfig] = await Promise.all([
    prisma.timerConfig.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.timerStyle.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.taskStyle.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.botConfig.upsert({ where: { userId }, create: { userId }, update: {} }),
  ]);

  return { timerConfig, timerStyle, taskStyle, botConfig };
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const timerStylesSchema = z.object({
  dimensions: z.object({ width: z.string(), height: z.string() }).optional(),
  background: z.object({ color: z.string(), opacity: z.number(), borderRadius: z.string() }).optional(),
  ring: z.object({
    enabled: z.boolean(),
    trackColor: z.string(),
    trackOpacity: z.number(),
    fillColor: z.string(),
    fillOpacity: z.number(),
    width: z.number(),
    gap: z.number(),
  }).optional(),
  text: z.object({ color: z.string(), outlineColor: z.string(), outlineSize: z.string(), fontFamily: z.string() }).optional(),
  fontSizes: z.object({ label: z.string(), time: z.string(), cycle: z.string() }).optional(),
});

const taskStylesSchema = z.object({
  display: z.object({ showDone: z.boolean(), showCount: z.boolean(), useCheckboxes: z.boolean(), crossOnDone: z.boolean(), numberOfLines: z.number() }).optional(),
  fonts: z.object({ header: z.string(), body: z.string() }).optional(),
  scroll: z.object({ enabled: z.boolean(), pixelsPerSecond: z.number(), gapBetweenLoops: z.number() }).optional(),
  header: z.object({
    height: z.string(), background: z.object({ color: z.string(), opacity: z.number() }),
    border: z.object({ color: z.string(), width: z.string(), radius: z.string() }),
    fontSize: z.string(), fontColor: z.string(), padding: z.string(),
  }).optional(),
  body: z.object({
    background: z.object({ color: z.string(), opacity: z.number() }),
    border: z.object({ color: z.string(), width: z.string(), radius: z.string() }),
    padding: z.object({ vertical: z.string(), horizontal: z.string() }),
  }).optional(),
  task: z.object({
    background: z.object({ color: z.string(), opacity: z.number() }),
    border: z.object({ color: z.string(), width: z.string(), radius: z.string() }),
    fontSize: z.string(), fontColor: z.string(), usernameColor: z.string(),
    padding: z.string(), marginBottom: z.string(), maxWidth: z.string(),
  }).optional(),
  taskDone: z.object({ background: z.object({ color: z.string(), opacity: z.number() }), fontColor: z.string() }).optional(),
  checkbox: z.object({
    size: z.string(), background: z.object({ color: z.string(), opacity: z.number() }),
    border: z.object({ color: z.string(), width: z.string(), radius: z.string() }),
    margin: z.object({ top: z.string(), left: z.string(), right: z.string() }),
    tickChar: z.string(), tickSize: z.string(), tickColor: z.string(),
  }).optional(),
  bullet: z.object({
    char: z.string(), size: z.string(), color: z.string(),
    margin: z.object({ top: z.string(), left: z.string(), right: z.string() }),
  }).optional(),
});

// ── Config router ─────────────────────────────────────────────────────────────

export const configRouter = router({
  /** Get all config for the current user (creates defaults if missing) */
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const config = await ensureUserConfig(ctx.prisma, userId);
    return {
      timerConfig: buildTimerConfig(config.timerConfig),
      timerStyles: buildTimerStylesConfig(config.timerStyle),
      taskStyles: buildTaskStylesConfig(config.taskStyle),
      botConfig: buildBotConfig(config.botConfig),
    };
  }),

  /** Update timer durations/behavior */
  updateTimerConfig: protectedProcedure
    .input(z.object({
      workDuration: z.number().int().min(1000).optional(),
      breakDuration: z.number().int().min(1000).optional(),
      longBreakDuration: z.number().int().min(1000).optional(),
      longBreakInterval: z.number().int().min(1).optional(),
      startingDuration: z.number().int().min(0).optional(),
      defaultCycles: z.number().int().min(1).max(99).optional(),
      showHours: z.boolean().optional(),
      noLastBreak: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const updated = await ctx.prisma.timerConfig.update({
        where: { userId },
        data: input,
      });
      ee.emit(`timerStateChange:${userId}`);
      return buildTimerConfig(updated);
    }),

  /** Update timer overlay styles */
  updateTimerStyles: protectedProcedure
    .input(z.object({ timerStyles: timerStylesSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const flat = flattenTimerStyles(input.timerStyles);
      const updated = await ctx.prisma.timerStyle.update({
        where: { userId },
        data: flat,
      });
      ee.emit(`timerStateChange:${userId}`);
      return buildTimerStylesConfig(updated);
    }),

  /** Update task list overlay styles */
  updateTaskStyles: protectedProcedure
    .input(z.object({ taskStyles: taskStylesSchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const flat = flattenTaskStyles(input.taskStyles);
      const updated = await ctx.prisma.taskStyle.update({
        where: { userId },
        data: flat,
      });
      ee.emit(`taskListChange:${userId}`);
      return buildTaskStylesConfig(updated);
    }),

  /** Update bot messages and toggles */
  updateMessages: protectedProcedure
    .input(
      z.object({
        taskCommandsEnabled: z.boolean(),
        timerCommandsEnabled: z.boolean(),
        task: z.object({
          taskAdded: z.string(),
          noTaskAdded: z.string(),
          noTaskContent: z.string(),
          noTaskToEdit: z.string(),
          taskEdited: z.string(),
          taskRemoved: z.string(),
          taskNext: z.string(),
          adminDeleteTasks: z.string(),
          taskDone: z.string(),
          taskCheck: z.string(),
          taskCheckUser: z.string(),
          noTask: z.string(),
          noTaskOther: z.string(),
          notMod: z.string(),
          clearedAll: z.string(),
          clearedDone: z.string(),
          nextNoContent: z.string(),
          help: z.string(),
        }),
        timer: z.object({
          workMsg: z.string(),
          breakMsg: z.string(),
          longBreakMsg: z.string(),
          workRemindMsg: z.string(),
          notRunning: z.string(),
          streamStarting: z.string(),
          wrongCommand: z.string(),
          timerRunning: z.string(),
          commandSuccess: z.string(),
          cycleWrong: z.string(),
          goalWrong: z.string(),
          finishResponse: z.string(),
          alreadyStarting: z.string(),
          eta: z.string(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.botConfig.update({
        where: { userId },
        data: {
          taskCommandsEnabled: input.taskCommandsEnabled,
          timerCommandsEnabled: input.timerCommandsEnabled,
          msgTaskAdded: input.task.taskAdded,
          msgNoTaskAdded: input.task.noTaskAdded,
          msgNoTaskContent: input.task.noTaskContent,
          msgNoTaskToEdit: input.task.noTaskToEdit,
          msgTaskEdited: input.task.taskEdited,
          msgTaskRemoved: input.task.taskRemoved,
          msgTaskNext: input.task.taskNext,
          msgAdminDeleteTasks: input.task.adminDeleteTasks,
          msgTaskDone: input.task.taskDone,
          msgTaskCheck: input.task.taskCheck,
          msgTaskCheckUser: input.task.taskCheckUser,
          msgNoTask: input.task.noTask,
          msgNoTaskOther: input.task.noTaskOther,
          msgNotMod: input.task.notMod,
          msgClearedAll: input.task.clearedAll,
          msgClearedDone: input.task.clearedDone,
          msgNextNoContent: input.task.nextNoContent,
          msgHelp: input.task.help,
          msgWorkMsg: input.timer.workMsg,
          msgBreakMsg: input.timer.breakMsg,
          msgLongBreakMsg: input.timer.longBreakMsg,
          msgWorkRemindMsg: input.timer.workRemindMsg,
          msgNotRunning: input.timer.notRunning,
          msgStreamStarting: input.timer.streamStarting,
          msgWrongCommand: input.timer.wrongCommand,
          msgTimerRunning: input.timer.timerRunning,
          msgCommandSuccess: input.timer.commandSuccess,
          msgCycleWrong: input.timer.cycleWrong,
          msgGoalWrong: input.timer.goalWrong,
          msgFinishResponse: input.timer.finishResponse,
          msgAlreadyStarting: input.timer.alreadyStarting,
          msgEta: input.timer.eta,
        },
      });
    }),

  /** Update phase labels (stored in TimerConfig) */
  updatePhaseLabels: protectedProcedure
    .input(
      z.object({
        idle: z.string(),
        starting: z.string(),
        work: z.string(),
        break: z.string(),
        longBreak: z.string(),
        paused: z.string(),
        finished: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const result = await ctx.prisma.timerConfig.update({
        where: { userId },
        data: {
          labelIdle: input.idle,
          labelStarting: input.starting,
          labelWork: input.work,
          labelBreak: input.break,
          labelLongBreak: input.longBreak,
          labelPaused: input.paused,
          labelFinished: input.finished,
        },
      });
      ee.emit(`timerStateChange:${userId}`);
      return result;
    }),

  /** Update command aliases */
  updateCommandAliases: protectedProcedure
    .input(z.object({ commandAliases: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.prisma.botConfig.update({
        where: { userId },
        data: { commandAliases: input.commandAliases as object },
      });
    }),
});
