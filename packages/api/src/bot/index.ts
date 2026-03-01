import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import type prismaDefault from "@dirework/db";

import { env } from "@dirework/env/server";

type PrismaClient = typeof prismaDefault;
import { ee } from "../events";
import { buildBotConfig } from "../routers/config";
import type { BotConfigData } from "./commands";
import { handleMessage } from "./commands";

class TwitchBotService {
  private authProvider: RefreshingAuthProvider | null = null;
  private chatClient: ChatClient | null = null;
  private prisma: PrismaClient | null = null;
  private userId: string | null = null;
  private channelName: string | null = null;
  private botUsername: string | null = null;
  private configCache: BotConfigData | null = null;
  private configListener: (() => void) | null = null;

  async start(prisma: PrismaClient, userId: string): Promise<void> {
    if (this.chatClient) {
      throw new Error("Bot is already running");
    }

    this.prisma = prisma;
    this.userId = userId;

    // Load bot account + user
    const [botAccount, user] = await Promise.all([
      prisma.botAccount.findUnique({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, twitchId: true } }),
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
      await prisma.botAccount.update({
        where: { userId },
        data: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken ?? botAccount.refreshToken,
          expiresAt: tokenData.expiresIn
            ? new Date(Date.now() + tokenData.expiresIn * 1000)
            : botAccount.expiresAt,
          scopes: tokenData.scope ?? botAccount.scopes,
        },
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

    // Create chat client
    this.chatClient = new ChatClient({
      authProvider: this.authProvider,
      channels: [this.channelName!],
    });

    // Register message handler
    this.chatClient.onMessage(async (channel, _userState, message, msg) => {
      if (!this.configCache || !this.prisma || !this.userId) return;

      const isBroadcaster = msg.userInfo.isBroadcaster;
      const isMod = msg.userInfo.isMod;

      try {
        await handleMessage({
          prisma: this.prisma,
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
        console.error("[Bot] Error handling message:", err);
      }
    });

    // Ban/timeout handlers — remove all tasks by that user
    this.chatClient.onBan(async (_channel, user) => {
      if (!this.prisma || !this.userId) return;
      try {
        await this.prisma.task.deleteMany({
          where: {
            ownerId: this.userId,
            authorUsername: { equals: user, mode: "insensitive" },
          },
        });
        ee.emit(`taskListChange:${this.userId}`);
      } catch (err) {
        console.error("[Bot] Error handling ban:", err);
      }
    });

    this.chatClient.onTimeout(async (_channel, user) => {
      if (!this.prisma || !this.userId) return;
      try {
        await this.prisma.task.deleteMany({
          where: {
            ownerId: this.userId,
            authorUsername: { equals: user, mode: "insensitive" },
          },
        });
        ee.emit(`taskListChange:${this.userId}`);
      } catch (err) {
        console.error("[Bot] Error handling timeout:", err);
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
        console.error("[Bot] Error reloading config:", err);
      });
    };
    ee.on(eventName, configHandler);
    this.configListener = () => ee.off(eventName, configHandler);

    console.log(`[Bot] Connected to #${this.channelName} as ${this.botUsername}`);
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
    this.prisma = null;
    this.userId = null;
    this.channelName = null;
    this.botUsername = null;
    this.configCache = null;

    console.log("[Bot] Disconnected");
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
    if (!this.prisma || !this.userId) return;

    const botConfig = await this.prisma.botConfig.findUnique({
      where: { userId: this.userId },
    });

    if (botConfig) {
      this.configCache = buildBotConfig(botConfig);
    }
  }
}

export const botService = new TwitchBotService();
