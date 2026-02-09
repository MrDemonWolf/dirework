import { z } from "zod";

import { protectedProcedure, router } from "../index";

const defaultTimerConfig = {
  workDuration: 25 * 60 * 1000,
  breakDuration: 5 * 60 * 1000,
  longBreakDuration: 15 * 60 * 1000,
  longBreakInterval: 4,
  startingDuration: 5000,
  defaultCycles: 4,
  labels: {
    work: "Focus",
    break: "Break",
    longBreak: "Long Break",
    starting: "Starting",
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

const defaultMessages = {
  taskAdded: "@{user}, task added!",
  taskDone: "@{user}, task marked done!",
  taskEdited: "@{user}, task updated!",
  taskRemoved: "@{user}, task removed!",
  noTasks: "@{user}, you have no tasks.",
  timerStarted: "Timer started! {duration} minutes",
  timerPaused: "Timer paused.",
  timerResumed: "Timer resumed!",
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
          messages: defaultMessages,
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
    .input(z.object({ messages: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.config.update({
        where: { userId: ctx.session.user.id },
        data: { messages: input.messages as object },
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
