import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { handleMessage } from "../bot/commands";
import { buildBotConfig } from "../config-shared";
import { protectedProcedure, publicProcedure, router } from "../index";
import { ensureBotConfig, ensureInstanceConfig } from "../services/provision";
import { removeTasksByUsername } from "../services/task-service";
import { tokenInput, verifyBotToken } from "../services/tokens";
import { getFreshChatToken } from "../services/twitch-auth";
import { updateSingleton } from "../services/singleton";

// The browser bot page (/bot/<token>) holds the Twitch IRC-over-WebSocket
// connection and relays every chat line here. These procedures are stateless —
// the twurple TwitchBotService is gone.

const ingestInput = z.object({
  token: tokenInput,
  kind: z.enum(["message", "clearchat"]).default("message"),
  username: z.string().min(1).max(64).optional(),
  displayName: z.string().min(1).max(64).optional(),
  twitchId: z.string().min(1).max(32).optional(),
  message: z.string().min(1).max(600).optional(),
  color: z.string().max(32).optional(),
  isMod: z.boolean().default(false),
  isBroadcaster: z.boolean().default(false),
  targetUsername: z.string().min(1).max(64).optional(),
});

export const botRouter = router({
  /**
   * Bot page bootstrap: validates the secret bot token and returns what the
   * browser IRC client needs. The chat token is refreshed server-side first if
   * it is near/past expiry. NEVER returns the refresh token.
   */
  getSession: publicProcedure
    .input(z.object({ token: tokenInput }))
    .query(async ({ ctx, input }) => {
      if (!(await verifyBotToken(ctx.db, input.token))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid bot token" });
      }

      const [botAccount, owner] = await Promise.all([
        ctx.db.query.botAccount.findFirst({ columns: { username: true } }),
        ctx.db.query.user.findFirst({ columns: { name: true } }),
      ]);

      if (!botAccount) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No bot account connected" });
      }
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Instance has no owner" });
      }

      const chatToken = await getFreshChatToken(ctx.db);
      if (!chatToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Bot chat token unavailable" });
      }

      return {
        channelName: owner.name,
        botUsername: botAccount.username,
        chatToken,
      };
    }),

  /**
   * Stateless chat ingest: the bot page posts each chat line (or a CLEARCHAT
   * ban/timeout event) and receives the replies to send back to chat.
   */
  ingest: publicProcedure
    .input(ingestInput)
    .mutation(async ({ ctx, input }): Promise<{ replies: string[] }> => {
      if (!(await verifyBotToken(ctx.db, input.token))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid bot token" });
      }

      // Moderation piggyback (L9): CLEARCHAT (ban/timeout) → drop the user's tasks.
      if (input.kind === "clearchat") {
        if (!input.targetUsername) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: 'targetUsername is required for kind "clearchat"',
          });
        }
        await removeTasksByUsername(ctx.db, input.targetUsername);
        return { replies: [] };
      }

      if (!input.username || !input.twitchId || !input.message) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: 'username, twitchId and message are required for kind "message"',
        });
      }

      const [botConfigRow, owner] = await Promise.all([
        ensureBotConfig(ctx.db),
        ctx.db.query.user.findFirst({ columns: { name: true } }),
      ]);

      const replies: string[] = [];
      await handleMessage({
        db: ctx.db,
        channelName: owner?.name ?? "",
        config: buildBotConfig(botConfigRow),
        message: input.message.trim(),
        userInfo: {
          twitchId: input.twitchId,
          username: input.username,
          displayName: input.displayName ?? input.username,
          color: input.color ?? null,
          isBroadcaster: input.isBroadcaster,
          isMod: input.isMod || input.isBroadcaster,
        },
        docsUrl: env.DOCS_URL,
        say: (text) => replies.push(text),
      });

      return { replies };
    }),

  /**
   * Dashboard info for building the /bot/<token> URL. Owner-authenticated —
   * this is the only place the bot page token leaves the server.
   */
  getIngestInfo: protectedProcedure.query(async ({ ctx }) => {
    const instance = await ensureInstanceConfig(ctx.db);

    const [botAccount, owner] = await Promise.all([
      ctx.db.query.botAccount.findFirst({ columns: { username: true } }),
      ctx.db.query.user.findFirst({ columns: { name: true } }),
    ]);

    return {
      botToken: instance.botToken,
      botUsername: botAccount?.username ?? null,
      channelName: owner?.name ?? null,
    };
  }),

  /** Rotate the bot page token (invalidates any previously copied URL). */
  regenerateBotToken: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureInstanceConfig(ctx.db);
    const botToken = crypto.randomUUID();
    await updateSingleton(ctx.db, schema.instanceConfig, { botToken });
    return { botToken };
  }),
});
