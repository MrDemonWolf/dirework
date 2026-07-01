import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as schema from "@dirework/db/schema";

import {
  buildBotConfig,
  buildTaskStylesConfig,
  buildTimerConfig,
  buildTimerStylesConfig,
  flattenTaskStyles,
  flattenTimerStyles,
} from "../config-shared";
import { protectedProcedure, router } from "../index";
import { ensureSingletons } from "../services/provision";
import { updateSingleton } from "../services/singleton";

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
  get: protectedProcedure.query(async ({ ctx }) => {
    const config = await ensureSingletons(ctx.db);
    return {
      timerConfig: buildTimerConfig(config.timerConfig),
      timerStyles: buildTimerStylesConfig(config.timerStyle),
      taskStyles: buildTaskStylesConfig(config.taskStyle),
      botConfig: buildBotConfig(config.botConfig),
    };
  }),

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
      await ensureSingletons(ctx.db);
      const updated = await updateSingleton(ctx.db, schema.timerConfig, input);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTimerConfig(updated);
    }),

  updateTimerStyles: protectedProcedure
    .input(z.object({ timerStyles: timerStylesSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const flat = flattenTimerStyles(input.timerStyles);
      const updated = await updateSingleton(ctx.db, schema.timerStyle, flat);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTimerStylesConfig(updated);
    }),

  updateTaskStyles: protectedProcedure
    .input(z.object({ taskStyles: taskStylesSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const flat = flattenTaskStyles(input.taskStyles);
      const updated = await updateSingleton(ctx.db, schema.taskStyle, flat);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTaskStylesConfig(updated);
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
      await ensureSingletons(ctx.db);
      return updateSingleton(ctx.db, schema.botConfig, {
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
      await ensureSingletons(ctx.db);
      return updateSingleton(ctx.db, schema.timerConfig, {
        labelIdle: input.idle,
        labelStarting: input.starting,
        labelWork: input.work,
        labelBreak: input.break,
        labelLongBreak: input.longBreak,
        labelPaused: input.paused,
        labelFinished: input.finished,
      });
    }),

  updateCommandAliases: protectedProcedure
    .input(z.object({
      commandAliases: z.record(z.string().max(50), z.string().max(100)).refine(
        (obj) => Object.keys(obj).length <= 50,
        { message: "Maximum of 50 command aliases allowed" },
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      // commandAliases is a json-mode text column — drizzle serializes it.
      return updateSingleton(ctx.db, schema.botConfig, {
        commandAliases: input.commandAliases,
      });
    }),
});
