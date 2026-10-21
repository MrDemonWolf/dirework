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
  MAX_BLOCKED_VIEWERS,
  PHASE_LABEL_FIELDS,
  TASK_MESSAGE_FIELDS,
  TIMER_MESSAGE_FIELDS,
} from "../config-shared";
import { ownerProcedure, router } from "../index";
import { blockViewer, setBotMuted, streamerLogin, unblockViewer } from "../services/bot-moderation";
import { ensureBotConfig, ensureSingletons } from "../services/provision";
import { definedValues, hasValues, updateSingleton } from "../services/singleton";
import {
  blockedViewerInput,
  setBotMutedInput,
  updateBotSettingsInput,
  updateStylesInput,
  updateTimerConfigInput,
} from "./input-schemas";

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

  // Moderation: the same services the !mute/!block chat commands call (audit M1).

  /** The dashboard's Muted switch. A guarded no-op when already in that state. */
  setBotMuted: ownerProcedure.input(setBotMutedInput).mutation(async ({ ctx, input }) => {
    await ensureSingletons(ctx.db);
    await setBotMuted(ctx.db, input.muted);
    return { muted: input.muted };
  }),

  /** Block a viewer's chat commands and remove every task they added. */
  blockViewer: ownerProcedure.input(blockedViewerInput).mutation(async ({ ctx, input }) => {
    // The streamer's real login is the one resolveChannelLogin cached for the bot's
    // IRC channel; the session's name can be a display name that differs from it.
    const [instance] = await Promise.all([
      ctx.db.query.instanceConfig.findFirst({ columns: { channelLogin: true } }),
      ensureBotConfig(ctx.db),
    ]);
    if (input.login === streamerLogin(instance?.channelLogin, ctx.session.user.name)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You can't block the streamer" });
    }
    // The guarded UPDATE decides; a no-op is reported, never shown as a success.
    const result = await blockViewer(ctx.db, input.login);
    if (!result.added) {
      throw result.reason === "already-blocked"
        ? new TRPCError({ code: "CONFLICT", message: `${input.login} is already blocked` })
        : new TRPCError({
            code: "BAD_REQUEST",
            message: `The block list is full (${MAX_BLOCKED_VIEWERS} names). Unblock someone first`,
          });
    }
    return { login: input.login };
  }),

  /** Let a blocked viewer use commands again (their removed tasks stay removed). */
  unblockViewer: ownerProcedure.input(blockedViewerInput).mutation(async ({ ctx, input }) => {
    await unblockViewer(ctx.db, input.login);
    return { login: input.login };
  }),
});
