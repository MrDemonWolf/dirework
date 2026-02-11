import { z } from "zod";

import { protectedProcedure, router } from "../index";

export const defaultTimerConfig = {
  workDuration: 25 * 60 * 1000,
  breakDuration: 5 * 60 * 1000,
  longBreakDuration: 15 * 60 * 1000,
  longBreakInterval: 4,
  startingDuration: 5000,
  defaultCycles: 4,
  labels: {
    idle: "Ready",
    starting: "Starting",
    work: "Focus",
    break: "Break",
    longBreak: "Long Break",
    paused: "Paused",
    finished: "Done",
  },
  showHours: false,
  noLastBreak: true,
};

const defaultTimerStyles = {
  dimensions: { width: "250px", height: "250px" },
  background: { color: "#1c1c1e", opacity: 0.85, borderRadius: "22%" },
  ring: {
    enabled: true,
    trackColor: "#ffffff",
    trackOpacity: 0.1,
    fillColor: "#34c759",
    fillOpacity: 1,
    width: 8,
    gap: 6,
  },
  text: { color: "#ffffff", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Montserrat" },
  fontSizes: { label: "18px", time: "48px", cycle: "16px" },
};

const defaultTaskStyles = {
  display: {
    showDone: true,
    showCount: true,
    useCheckboxes: true,
    crossOnDone: true,
    numberOfLines: 2,
  },
  fonts: { header: "Montserrat", body: "Roboto" },
  scroll: { pixelsPerSecond: 70, gapBetweenLoops: 100 },
  header: {
    height: "52px",
    background: { color: "#1c1c1e", opacity: 0.95 },
    border: { color: "#3a3a3c", width: "1px", radius: "12px 12px 0 0" },
    fontSize: "24px",
    fontColor: "#ffffff",
    padding: "12px 16px",
  },
  body: {
    background: { color: "#1c1c1e", opacity: 0.85 },
    border: { color: "#3a3a3c", width: "1px", radius: "0 0 12px 12px" },
    padding: { vertical: "6px", horizontal: "6px" },
  },
  task: {
    background: { color: "#2c2c2e", opacity: 0.9 },
    border: { color: "#3a3a3c", width: "0px", radius: "10px" },
    fontSize: "22px",
    fontColor: "#f5f5f7",
    usernameColor: "#bf5af2",
    padding: "10px 14px",
    marginBottom: "4px",
    maxWidth: "100%",
    direction: "row",
  },
  taskDone: {
    background: { color: "#1c1c1e", opacity: 0.5 },
    fontColor: "#8e8e93",
  },
  checkbox: {
    size: "20px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#636366", width: "2px", radius: "6px" },
    margin: { top: "4px", left: "2px", right: "8px" },
    tickChar: "\u2714",
    tickSize: "14px",
    tickColor: "#34c759",
  },
  bullet: {
    char: "\u2022",
    size: "20px",
    color: "#8e8e93",
    margin: { top: "0px", left: "2px", right: "8px" },
  },
};

export const configRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    let config = await ctx.prisma.config.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!config) {
      config = await ctx.prisma.config.create({
        data: {
          userId: ctx.session.user.id,
          timer: defaultTimerConfig,
          timerStyles: defaultTimerStyles,
          taskStyles: defaultTaskStyles,
          commandAliases: {},
        },
      });
    }

    return config;
  }),

  updateTimer: protectedProcedure
    .input(z.object({ timer: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
        data: { timer: input.timer as object },
      });
    }),

  updateTimerStyles: protectedProcedure
    .input(z.object({ timerStyles: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
        data: { timerStyles: input.timerStyles as object },
      });
    }),

  updateTaskStyles: protectedProcedure
    .input(z.object({ taskStyles: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
        data: { taskStyles: input.taskStyles as object },
      });
    }),

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
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
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
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
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
    }),

  updateCommandAliases: protectedProcedure
    .input(z.object({ commandAliases: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
        data: { commandAliases: input.commandAliases as object },
      });
    }),
});
