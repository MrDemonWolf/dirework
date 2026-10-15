import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

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
  TASK_MESSAGE_FIELDS,
  TIMER_MESSAGE_FIELDS,
} from "../config-shared";
import { ownerProcedure, router } from "../index";
import { ensureSingletons } from "../services/provision";
import { definedValues, hasValues, updateSingleton } from "../services/singleton";
import { updateBotSettingsInput, updateStylesInput, updateTimerConfigInput } from "./input-schemas";

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

  /**
   * Save the whole Theme Center in ONE mutation, so a failure can never leave
   * the config half-written and the UI's saved-state snapshot diverged from the
   * server. `db.batch` puts both style rows and the labels in a single atomic
   * D1 round trip.
   */
  updateStyles: ownerProcedure.input(updateStylesInput).mutation(async ({ ctx, input }) => {
    await ensureSingletons(ctx.db);
    const timerStylePatch = definedValues(flattenTimerStyles(input.timerStyles));
    const taskStylePatch = definedValues(flattenTaskStyles(input.taskStyles));
    const labelsPatch = definedValues(flattenWithFieldMap(PHASE_LABEL_FIELDS, input.phaseLabels));
    // An empty SET is a SQL error, so only the groups that changed are written.
    const statements = [
      ...(hasValues(timerStylePatch)
        ? [
            ctx.db
              .update(schema.timerStyle)
              .set(timerStylePatch)
              .where(eq(schema.timerStyle.id, SINGLETON_ID)),
          ]
        : []),
      ...(hasValues(taskStylePatch)
        ? [
            ctx.db
              .update(schema.taskStyle)
              .set(taskStylePatch)
              .where(eq(schema.taskStyle.id, SINGLETON_ID)),
          ]
        : []),
      ...(hasValues(labelsPatch)
        ? [
            ctx.db
              .update(schema.timerConfig)
              .set(labelsPatch)
              .where(eq(schema.timerConfig.id, SINGLETON_ID)),
          ]
        : []),
    ];
    const [first, ...rest] = statements;
    if (first) await ctx.db.batch([first, ...rest]);

    const config = await ensureSingletons(ctx.db);
    return {
      timerStyles: buildTimerStylesConfig(config.timerStyle),
      taskStyles: buildTaskStylesConfig(config.taskStyle),
      timerConfig: buildTimerConfig(config.timerConfig),
    };
  }),

  /**
   * Save messages + command aliases together in one write to the bot_config
   * row, so the two can never be half-persisted.
   */
  updateBotSettings: ownerProcedure
    .input(updateBotSettingsInput)
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
