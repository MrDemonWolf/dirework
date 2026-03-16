import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { eq, and, sql } from "drizzle-orm";
import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";

import { env } from "@dirework/env/server";
import { ee } from "../events";
import { logger } from "../logger";
import { buildBotConfig } from "../routers/config";
import type { BotConfigData } from "./commands";
import { handleMessage } from "./commands";

class TwitchBotService {
  private authProvider: RefreshingAuthProvider | null = null;
  private chatClient: ChatClient | null = null;
  private db: DbClient | null = null;
  private userId: string | null = null;
  private channelName: string | null = null;
  private botUsername: string | null = null;
  private configCache: BotConfigData | null = null;
  private configListener: (() => void) | null = null;

  async start(db: DbClient, userId: string): Promise<void> {
    if (this.chatClient) {
      throw new Error("Bot is already running");
    }

    this.db = db;
    this.userId = userId;

    // Load bot account + user
    const [botAccount, user] = await Promise.all([
      db.query.botAccount.findFirst({ where: eq(schema.botAccount.userId, userId) }),
      db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true, twitchId: true } }),
    ]);

    if (!botAccount || !user) {
      throw new Error("Bot account or user not found");
    }

    this.channelName = user.name;
    this.botUsername = botAccount.username;

    // Set up auth provider
    this.authProvider = new RefreshingAuthProvider({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
    });

    this.authProvider.onRefresh(async (_userId, tokenData) => {
      // Persist refreshed tokens
      await db.update(schema.botAccount)
        .set({
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken ?? botAccount.refreshToken,
          expiresAt: tokenData.expiresIn
            ? new Date(Date.now() + tokenData.expiresIn * 1000)
            : botAccount.expiresAt,
          scopes: tokenData.scope ?? botAccount.scopes,
        })
        .where(eq(schema.botAccount.userId, userId));
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

    // Create chat client
    this.chatClient = new ChatClient({
      authProvider: this.authProvider,
      channels: [this.channelName!],
    });

    // Register message handler
    this.chatClient.onMessage(async (channel, _userState, message, msg) => {
      if (!this.configCache || !this.db || !this.userId) return;

      const isBroadcaster = msg.userInfo.isBroadcaster;
      const isMod = msg.userInfo.isMod;

      try {
        await handleMessage({
          db: this.db,
          ownerId: this.userId,
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
      if (!this.db || !this.userId) return;
      try {
        await this.db.delete(schema.task)
          .where(and(
            eq(schema.task.ownerId, this.userId),
            sql`lower(${schema.task.authorUsername}) = lower(${username})`,
          ));
        ee.emit(`taskListChange:${this.userId}`);
      } catch (err) {
        logger.error("[Bot] Error handling ban:", err);
      }
    });

    this.chatClient.onTimeout(async (_channel, username) => {
      if (!this.db || !this.userId) return;
      try {
        await this.db.delete(schema.task)
          .where(and(
            eq(schema.task.ownerId, this.userId),
            sql`lower(${schema.task.authorUsername}) = lower(${username})`,
          ));
        ee.emit(`taskListChange:${this.userId}`);
      } catch (err) {
        logger.error("[Bot] Error handling timeout:", err);
      }
    });

    // Connect
    this.chatClient.connect();

    // Load + cache config
    await this.reloadConfig();

    // Listen for config changes
    const eventName = `botConfigChange:${userId}`;
    const configHandler = () => {
      this.reloadConfig().catch((err) => {
        logger.error("[Bot] Error reloading config:", err);
      });
    };
    ee.on(eventName, configHandler);
    this.configListener = () => ee.off(eventName, configHandler);

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
    this.userId = null;
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
    if (!this.db || !this.userId) return;

    // Ensure a default row exists (first-start case, before user visits config page)
    await this.db.insert(schema.botConfig)
      .values({ userId: this.userId })
      .onConflictDoNothing();

    const botConfigRow = await this.db.query.botConfig.findFirst({
      where: eq(schema.botConfig.userId, this.userId),
    });

    if (botConfigRow) {
      this.configCache = buildBotConfig(botConfigRow);
    }
  }
}

export const botService = new TwitchBotService();
