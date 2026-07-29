import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import * as schema from "@dirework/db/schema";
import { SINGLETON_ID } from "@dirework/db/schema";

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
import { ownerProcedure, router } from "../index";
import { ensureSingletons } from "../services/provision";
import { updateSingleton } from "../services/singleton";
import { commandAliasesInput, updateMessagesInput, updateTimerConfigInput } from "./input-schemas";

// Input schemas live in ../config-shared (styles/messages/labels — derived
// from the same field maps as the build/flatten helpers, so the zod shape,
// the TS types, and the DB mapping cannot drift) and ./input-schemas.

export const configRouter = router({
  get: ownerProcedure.query(async ({ ctx }) => {
    const config = await ensureSingletons(ctx.db);
    return {
      timerConfig: buildTimerConfig(config.timerConfig),
      timerStyles: buildTimerStylesConfig(config.timerStyle),
      taskStyles: buildTaskStylesConfig(config.taskStyle),
      botConfig: buildBotConfig(config.botConfig),
    };
  }),

  updateTimerConfig: ownerProcedure
    .input(updateTimerConfigInput)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const updated = await updateSingleton(ctx.db, schema.timerConfig, input);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTimerConfig(updated);
    }),

  updateTimerStyles: ownerProcedure
    .input(z.object({ timerStyles: timerStylesInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const flat = flattenTimerStyles(input.timerStyles);
      const updated = await updateSingleton(ctx.db, schema.timerStyle, flat);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTimerStylesConfig(updated);
    }),

  updateTaskStyles: ownerProcedure
    .input(z.object({ taskStyles: taskStylesInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const flat = flattenTaskStyles(input.taskStyles);
      const updated = await updateSingleton(ctx.db, schema.taskStyle, flat);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildTaskStylesConfig(updated);
    }),

  updateMessages: ownerProcedure.input(updateMessagesInput).mutation(async ({ ctx, input }) => {
    await ensureSingletons(ctx.db);
    return updateSingleton(ctx.db, schema.botConfig, {
      taskCommandsEnabled: input.taskCommandsEnabled,
      timerCommandsEnabled: input.timerCommandsEnabled,
      ...flattenWithFieldMap(TASK_MESSAGE_FIELDS, input.task),
      ...flattenWithFieldMap(TIMER_MESSAGE_FIELDS, input.timer),
    });
  }),

  updatePhaseLabels: ownerProcedure
    .input(phaseLabelsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      return updateSingleton(
        ctx.db,
        schema.timerConfig,
        flattenWithFieldMap(PHASE_LABEL_FIELDS, input),
      );
    }),

  updateCommandAliases: ownerProcedure
    .input(commandAliasesInput)
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      // commandAliases is a json-mode text column — drizzle serializes it.
      return updateSingleton(ctx.db, schema.botConfig, {
        commandAliases: input.commandAliases,
      });
    }),

  /**
   * Save the whole Theme Center in ONE mutation (P1.10). The styles page used
   * to fire updateTimerStyles + updateTaskStyles + updatePhaseLabels as three
   * independent requests, so a failure of any one left the config half-written
   * and the UI's saved-state snapshot diverged from the server. `db.batch` puts
   * both style rows and the labels in a single atomic D1 round trip.
   */
  updateStyles: ownerProcedure
    .input(
      z.object({
        timerStyles: timerStylesInputSchema,
        taskStyles: taskStylesInputSchema,
        phaseLabels: phaseLabelsInputSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      await ctx.db.batch([
        ctx.db
          .update(schema.timerStyle)
          .set(flattenTimerStyles(input.timerStyles))
          .where(eq(schema.timerStyle.id, SINGLETON_ID)),
        ctx.db
          .update(schema.taskStyle)
          .set(flattenTaskStyles(input.taskStyles))
          .where(eq(schema.taskStyle.id, SINGLETON_ID)),
        ctx.db
          .update(schema.timerConfig)
          .set(flattenWithFieldMap(PHASE_LABEL_FIELDS, input.phaseLabels))
          .where(eq(schema.timerConfig.id, SINGLETON_ID)),
      ]);

      const config = await ensureSingletons(ctx.db);
      return {
        timerStyles: buildTimerStylesConfig(config.timerStyle),
        taskStyles: buildTaskStylesConfig(config.taskStyle),
        timerConfig: buildTimerConfig(config.timerConfig),
      };
    }),

  /**
   * Save messages + command aliases together (P1.10) — same partial-persistence
   * problem as updateStyles, both targeting the bot_config row.
   */
  updateBotSettings: ownerProcedure
    .input(updateMessagesInput.extend(commandAliasesInput.shape))
    .mutation(async ({ ctx, input }) => {
      await ensureSingletons(ctx.db);
      const updated = await updateSingleton(ctx.db, schema.botConfig, {
        taskCommandsEnabled: input.taskCommandsEnabled,
        timerCommandsEnabled: input.timerCommandsEnabled,
        commandAliases: input.commandAliases,
        ...flattenWithFieldMap(TASK_MESSAGE_FIELDS, input.task),
        ...flattenWithFieldMap(TIMER_MESSAGE_FIELDS, input.timer),
      });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Config row not found" });
      return buildBotConfig(updated);
    }),
});
