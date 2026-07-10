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
  flattenWithFieldMap,
  PHASE_LABEL_FIELDS,
  phaseLabelsInputSchema,
  TASK_MESSAGE_FIELDS,
  taskStylesInputSchema,
  TIMER_MESSAGE_FIELDS,
  timerStylesInputSchema,
} from "../config-shared";
import { protectedProcedure, router } from "../index";
import { ensureSingletons } from "../services/provision";
import { updateSingleton } from "../services/singleton";
import { commandAliasesInput, updateMessagesInput, updateTimerConfigInput } from "./input-schemas";

// Input schemas live in ../config-shared (styles/messages/labels — derived
// from the same field maps as the build/flatten helpers, so the zod shape,
// the TS types, and the DB mapping cannot drift) and ./input-schemas.

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
    .input(updateTimerConfigInput)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const updated = await updateSingleton(ctx.db, schema.timerConfig, input);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTimerConfig(updated);
    }),

  updateTimerStyles: protectedProcedure
    .input(z.object({ timerStyles: timerStylesInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const flat = flattenTimerStyles(input.timerStyles);
      const updated = await updateSingleton(ctx.db, schema.timerStyle, flat);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTimerStylesConfig(updated);
    }),

  updateTaskStyles: protectedProcedure
    .input(z.object({ taskStyles: taskStylesInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const flat = flattenTaskStyles(input.taskStyles);
      const updated = await updateSingleton(ctx.db, schema.taskStyle, flat);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTaskStylesConfig(updated);
    }),

  updateMessages: protectedProcedure
    .input(updateMessagesInput)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      return updateSingleton(ctx.db, schema.botConfig, {
        taskCommandsEnabled: input.taskCommandsEnabled,
        timerCommandsEnabled: input.timerCommandsEnabled,
        ...flattenWithFieldMap(TASK_MESSAGE_FIELDS, input.task),
        ...flattenWithFieldMap(TIMER_MESSAGE_FIELDS, input.timer),
      });
    }),

  updatePhaseLabels: protectedProcedure
    .input(phaseLabelsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      return updateSingleton(
        ctx.db,
        schema.timerConfig,
        flattenWithFieldMap(PHASE_LABEL_FIELDS, input),
      );
    }),

  updateCommandAliases: protectedProcedure
    .input(commandAliasesInput)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      // commandAliases is a json-mode text column — drizzle serializes it.
      return updateSingleton(ctx.db, schema.botConfig, {
        commandAliases: input.commandAliases,
      });
    }),
});
