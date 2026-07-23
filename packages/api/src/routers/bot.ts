import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { handleMessage } from "../bot/commands";
import { buildBotConfig } from "../config-shared";
import { protectedProcedure, publicProcedure, router } from "../index";
import { ensureBotConfig, ensureInstanceConfig } from "../services/provision";
import { removeTasksByUsername } from "../services/task-service";
import { requireBotToken, tokenInput } from "../services/tokens";
import { getFreshChatToken, resolveChannelLogin } from "../services/twitch-auth";
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

/** The owner-user + bot-account singleton lookups the bot procedures repeat. */
async function loadOwnerAndBotAccount(db: DbClient) {
  const [owner, botAccount] = await Promise.all([
    db.query.user.findFirst({
      columns: { name: true, displayName: true, twitchId: true },
    }),
    db.query.botAccount.findFirst({ columns: { username: true } }),
  ]);
  return { owner: owner ?? null, botAccount: botAccount ?? null };
}

export const botRouter = router({
  /**
   * Bot page bootstrap: validates the secret bot token and returns what the
   * browser IRC client needs. The chat token is refreshed server-side first if
   * it is near/past expiry. NEVER returns the refresh token.
   */
  getSession: publicProcedure
    .input(z.object({
      token: tokenInput,
      // Set by the bot page after Twitch rejects the stored token (IRC auth
      // failure) — bypasses the expiry check so recovery never hands back the
      // same dead token.
      forceRefresh: z.boolean().optional(),
      // Set by the bot page's hourly liveness tick — validates a still-unexpired
      // token against Twitch and refreshes only if it has been revoked.
      revalidate: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireBotToken(ctx.db, input.token);

      const { owner, botAccount } = await loadOwnerAndBotAccount(ctx.db);

      if (!botAccount) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No bot account connected" });
      }
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Instance has no owner" });
      }

      const creds = {
        clientId: env.TWITCH_CLIENT_ID,
        clientSecret: env.TWITCH_CLIENT_SECRET,
      };
      const chatToken = await getFreshChatToken(ctx.db, creds, {
        forceRefresh: input.forceRefresh,
        revalidate: input.revalidate,
      });
      if (!chatToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Bot chat token unavailable" });
      }

      // IRC JOIN needs the owner's lowercase *login*, not the display name.
      const channelName = await resolveChannelLogin(
        ctx.db,
        { clientId: creds.clientId, accessToken: chatToken },
        {
          twitchId: owner.twitchId,
          fallbackName: owner.displayName ?? owner.name,
        },
      );

      return {
        channelName,
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
      await requireBotToken(ctx.db, input.token);

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
    const { owner, botAccount } = await loadOwnerAndBotAccount(ctx.db);

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
