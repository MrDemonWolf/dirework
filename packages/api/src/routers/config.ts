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
  background: { color: "#000000", opacity: 0.5, borderRadius: "50%" },
  text: { color: "#ffffff", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Inter" },
  fontSizes: { label: "24px", time: "48px", cycle: "20px" },
};

const defaultTaskStyles = {
  display: {
    showDone: true,
    showCount: true,
    useCheckboxes: true,
    crossOnDone: true,
    numberOfLines: 2,
  },
  fonts: { header: "Fredoka One", body: "Nunito" },
  scroll: { pixelsPerSecond: 70, gapBetweenLoops: 100 },
  header: {
    height: "60px",
    background: { color: "#000000", opacity: 0.9 },
    border: { color: "#ffffff", width: "2px", radius: "10px" },
    fontSize: "30px",
    fontColor: "#ffffff",
    padding: "10px",
  },
  body: {
    background: { color: "#000000", opacity: 0 },
    border: { color: "#ffffff", width: "0px", radius: "0px" },
    padding: { vertical: "5px", horizontal: "5px" },
  },
  task: {
    background: { color: "#000000", opacity: 0.8 },
    border: { color: "#000000", width: "0px", radius: "5px" },
    fontSize: "25px",
    fontColor: "#ffffff",
    usernameColor: "#ffffff",
    padding: "10px",
    marginBottom: "5px",
    maxWidth: "100%",
    direction: "row",
  },
  taskDone: {
    background: { color: "#000000", opacity: 0.5 },
    fontColor: "#bbbbbb",
  },
  checkbox: {
    size: "20px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#ffffff", width: "1px", radius: "3px" },
    margin: { top: "6px", left: "2px", right: "5px" },
    tickChar: "\u2714",
    tickSize: "18px",
    tickColor: "#ffffff",
  },
  bullet: {
    char: "\u2022",
    size: "20px",
    color: "#ffffff",
    margin: { top: "0px", left: "2px", right: "5px" },
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
