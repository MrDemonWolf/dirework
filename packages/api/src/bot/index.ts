import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { sql } from "drizzle-orm";
import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { env } from "@dirework/env/server";
import { ee, TASK_LIST_CHANGE, BOT_CONFIG_CHANGE } from "../events";
import { logger } from "../logger";
import { buildBotConfig } from "../routers/config";
import type { BotConfigData } from "./commands";
import { handleMessage } from "./commands";

class TwitchBotService {
  private authProvider: RefreshingAuthProvider | null = null;
  private chatClient: ChatClient | null = null;
  private db: DbClient | null = null;
  private channelName: string | null = null;
  private botUsername: string | null = null;
  private configCache: BotConfigData | null = null;
  private configListener: (() => void) | null = null;

  async start(db: DbClient): Promise<void> {
    if (this.chatClient) {
      throw new Error("Bot is already running");
    }

    this.db = db;

    // Load bot account + owner
    const [botAccount, owner] = await Promise.all([
      db.query.botAccount.findFirst(),
      db.query.user.findFirst({ columns: { name: true, twitchId: true } }),
    ]);

    if (!botAccount || !owner) {
      throw new Error("Bot account or owner not found");
    }

    this.channelName = owner.name;
    this.botUsername = botAccount.username;

    // Set up auth provider
    this.authProvider = new RefreshingAuthProvider({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    });

    this.authProvider.onRefresh(async (_userId, tokenData) => {
      await db.update(schema.botAccount)
        .set({
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken ?? botAccount.refreshToken,
          expiresAt: tokenData.expiresIn != null
            ? new Date(Date.now() + tokenData.expiresIn * 1000)
            : botAccount.expiresAt,
          scopes: tokenData.scope ?? botAccount.scopes,
        });
    });

    await this.authProvider.addUserForToken(
      {
        accessToken: botAccount.accessToken,
        refreshToken: botAccount.refreshToken,
        expiresIn: 0,
        obtainmentTimestamp: 0,
        scope: botAccount.scopes,
      },
      ["chat"],
    );

    this.chatClient = new ChatClient({
      authProvider: this.authProvider,
      channels: [this.channelName!],
    });

    this.chatClient.onMessage(async (channel, _userState, message, msg) => {
      if (!this.configCache || !this.db) return;

      const isBroadcaster = msg.userInfo.isBroadcaster;
      const isMod = msg.userInfo.isMod;

      try {
        await handleMessage({
          db: this.db,
          channelName: this.channelName!,
          config: this.configCache,
          message: message.trim(),
          userInfo: {
            twitchId: msg.userInfo.userId,
            username: msg.userInfo.userName,
            displayName: msg.userInfo.displayName,
            color: msg.userInfo.color ?? null,
            isBroadcaster,
            isMod: isMod || isBroadcaster,
          },
          say: (text: string) => this.chatClient!.say(channel, text),
        });
      } catch (err) {
        logger.error("[Bot] Error handling message:", err);
      }
    });

    // Ban/timeout handlers — remove all tasks by that user
    this.chatClient.onBan(async (_channel, username) => {
      if (!this.db) return;
      try {
        await this.db.delete(schema.task)
          .where(sql`lower(${schema.task.authorUsername}) = lower(${username})`);
        ee.emit(TASK_LIST_CHANGE);
      } catch (err) {
        logger.error("[Bot] Error handling ban:", err);
      }
    });

    this.chatClient.onTimeout(async (_channel, username) => {
      if (!this.db) return;
      try {
        await this.db.delete(schema.task)
          .where(sql`lower(${schema.task.authorUsername}) = lower(${username})`);
        ee.emit(TASK_LIST_CHANGE);
      } catch (err) {
        logger.error("[Bot] Error handling timeout:", err);
      }
    });

    this.chatClient.connect();

    await this.reloadConfig();

    const configHandler = () => {
      this.reloadConfig().catch((err) => {
        logger.error("[Bot] Error reloading config:", err);
      });
    };
    ee.on(BOT_CONFIG_CHANGE, configHandler);
    this.configListener = () => ee.off(BOT_CONFIG_CHANGE, configHandler);

    logger.info(`[Bot] Connected to #${this.channelName} as ${this.botUsername}`);
  }

  async stop(): Promise<void> {
    if (this.configListener) {
      this.configListener();
      this.configListener = null;
    }

    if (this.chatClient) {
      this.chatClient.quit();
      this.chatClient = null;
    }

    this.authProvider = null;
    this.db = null;
    this.channelName = null;
    this.botUsername = null;
    this.configCache = null;

    logger.info("[Bot] Disconnected");
  }

  isRunning(): boolean {
    return this.chatClient !== null;
  }

  getStatus(): { running: boolean; channel: string | null; botUsername: string | null } {
    return {
      running: this.isRunning(),
      channel: this.channelName,
      botUsername: this.botUsername,
    };
  }

  async reloadConfig(): Promise<void> {
    if (!this.db) return;

    await this.db.insert(schema.botConfig)
      .values({})
      .onConflictDoNothing();

    const botConfigRow = await this.db.query.botConfig.findFirst();

    if (botConfigRow) {
      this.configCache = buildBotConfig(botConfigRow);
    }
  }
}

export const botService = new TwitchBotService();
