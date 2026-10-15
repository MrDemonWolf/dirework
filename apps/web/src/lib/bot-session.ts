/**
 * Bot console session state machine, kept free of React so it can be tested
 * with fake timers. The bot page component maps its events onto state.
 *
 * Owns: getSession bootstrap (with startup + hourly Twitch validation), the
 * bounded auth-failure recovery loop, retry backoff, the "no bot account yet"
 * slow poll, and serialized chat ingest.
 *
 * Secrets: the chat token is handed straight to the IRC client and kept only
 * for the rotation comparison — never emitted in an event.
 */

import { classifyBotError } from "./bot-session-errors";
import type { IrcChatMessage, IrcClientCallbacks, IrcCredentials, IrcStatus } from "./irc-client";
import { createSerialQueue } from "./serial-queue";

/**
 * - `not-configured`: no bot account (or owner) yet — keeps polling slowly so
 *   connecting the bot from the dashboard picks up without reloading OBS.
 * - `invalid`: the bot link was never valid. `revoked`: it was reset.
 * - `reauth`: the link is fine but the bot's Twitch login can no longer be
 *   refreshed (or Twitch kept rejecting it) — reconnect the bot account.
 */
export type BotPhase = "boot" | "live" | "not-configured" | "invalid" | "revoked" | "reauth";

export type BotActivityKind = "info" | "chat" | "reply" | "error";

export type BotCounter = "seen" | "commands" | "replies";

export type BotIngestInput =
  | {
      token: string;
      kind: "message";
      username: string;
      displayName?: string;
      twitchId: string;
      message: string;
      color?: string;
      isMod: boolean;
      /** IRC message id; the server dedupes on it when two bot pages relay the same line. */
      messageId?: string;
    }
  | { token: string; kind: "clearchat"; targetUsername: string };

export interface BotSessionApi {
  getSession(input: {
    token: string;
    forceRefresh?: boolean;
    revalidate?: boolean;
  }): Promise<{ channelName: string; botUsername: string; chatToken: string }>;
  ingest(input: BotIngestInput): Promise<{ replies: string[] }>;
}

/** The slice of TwitchIrcClient the session drives. */
export interface BotIrcClient {
  connect(creds: IrcCredentials): void;
  disconnect(): void;
  dispose(): void;
  say(text: string): void;
}

export interface BotSessionEvents {
  onPhase(phase: BotPhase): void;
  onIrcStatus(status: IrcStatus): void;
  onIdentity(identity: { channelName: string; botUsername: string }): void;
  /** Fired on every clean IRC connect. */
  onConnected(): void;
  onCounter(counter: BotCounter): void;
  onActivity(kind: BotActivityKind, text: string): void;
}

export interface BotSessionOptions {
  token: string;
  api: BotSessionApi;
  createClient: (callbacks: IrcClientCallbacks) => BotIrcClient;
  events: BotSessionEvents;
  /** Jitter source, injectable for tests. */
  random?: () => number;
}

export interface BotSession {
  dispose(): void;
}

/**
 * Consecutive failed auth recoveries (no clean connect between them) before
 * giving up: a refreshable-but-rejected token would otherwise retry forever.
 */
export const MAX_AUTH_RECOVERY = 5;
export const AUTH_RECOVERY_DELAY_MS = 2000;
/** Hourly liveness check — validates the token and reconnects only on rotation. */
export const REVALIDATE_INTERVAL_MS = 60 * 60 * 1000;
/** No bot account yet: a slow poll keeps a parked OBS source cheap. */
export const NOT_CONFIGURED_POLL_MS = 60 * 1000;
/** Transient getSession failures back off exponentially up to the cap. */
export const RETRY_BASE_MS = 5000;
export const RETRY_MAX_MS = 5 * 60 * 1000;

/** Capped exponential backoff with ±20% jitter so many tabs don't retry in lockstep. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  return Math.round(base * (0.8 + random() * 0.4));
}

export function createBotSession({
  token,
  api,
  createClient,
  events,
  random = Math.random,
}: BotSessionOptions): BotSession {
  let disposed = false;
  let revoked = false;
  let wasLive = false;
  let notConfigured = false;
  let currentChatToken: string | null = null;
  let currentChannelName: string | null = null;
  let authRecoveryAttempts = 0;
  let retryAttempts = 0;
  let revalidateTimer: ReturnType<typeof setInterval> | null = null;
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  const inactive = () => disposed || revoked;

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      if (!inactive()) fn();
    }, ms);
    pendingTimers.add(timer);
  };

  // Permanent stop: "revoked" when the URL was regenerated on the dashboard,
  // "reauth" when the bot's Twitch login can no longer be refreshed.
  const stop = (next: "revoked" | "reauth") => {
    if (revoked) return;
    revoked = true;
    events.onPhase(next);
    client.dispose();
  };
  const enterRevoked = () => stop("revoked");

  /**
   * Relay one chat line to the stateless API. Mutations are deliberately not
   * retried: if D1 commits but the response is lost, an automatic retry would
   * apply commands such as !done, !next, or !timer skip twice.
   */
  const ingestOnce = async (input: BotIngestInput): Promise<string[]> => {
    try {
      const result = await api.ingest(input);
      return result.replies;
    } catch (err) {
      if (classifyBotError(err) === "revoked") enterRevoked();
      else events.onActivity("error", "could not send that command to Dirework — message dropped");
      return [];
    }
  };

  /**
   * Chat commands are relayed ONE AT A TIME so two commands from the same
   * viewer can't execute against the same DB snapshot and interleave (e.g.
   * "!done" and "!task" racing over which task ends up active). A serial
   * queue preserves chat order and keeps the bot to one in-flight mutation.
   */
  const runSerially = createSerialQueue();
  const ingest = (input: BotIngestInput): Promise<string[]> => runSerially(() => ingestOnce(input));

  const handleChat = (chat: IrcChatMessage) => {
    events.onCounter("seen");
    const text = chat.message.trim();
    // Every Dirework command starts with "!" — skipping plain chatter saves
    // free-tier Worker requests.
    if (!text.startsWith("!")) return;
    events.onCounter("commands");
    events.onActivity("chat", `${chat.displayName ?? chat.username}: ${text}`);
    void (async () => {
      const replies = await ingest({
        token,
        kind: "message",
        username: chat.username,
        displayName: chat.displayName,
        twitchId: chat.twitchId,
        message: text,
        color: chat.color,
        isMod: chat.isMod,
        messageId: chat.messageId,
      });
      if (inactive()) return;
      for (const reply of replies) {
        client.say(reply);
        events.onCounter("replies");
        events.onActivity("reply", `→ ${reply}`);
      }
    })();
  };

  const client = createClient({
    onStatus: (status) => {
      if (inactive()) return;
      events.onIrcStatus(status);
      if (status === "connected") {
        authRecoveryAttempts = 0; // a clean connect clears the recovery budget
        events.onConnected();
        events.onActivity("info", "connected to Twitch IRC");
      }
    },
    onChat: (chat) => {
      if (inactive()) return;
      handleChat(chat);
    },
    onClearChat: (targetUsername) => {
      if (inactive()) return;
      events.onActivity("info", `clearchat: ${targetUsername} — removing their tasks`);
      // No replies expected for moderation events.
      void ingest({ token, kind: "clearchat", targetUsername });
    },
    onError: (message) => {
      if (inactive()) return;
      events.onActivity("error", message);
    },
    onAuthFailure: () => {
      if (inactive()) return;
      // Twitch rejected the stored token, so its DB expiry can't be trusted —
      // force the server through the refresh flow instead of letting it hand
      // back the same dead token. Small delay avoids a tight loop.
      authRecoveryAttempts += 1;
      if (authRecoveryAttempts > MAX_AUTH_RECOVERY) {
        events.onActivity(
          "error",
          "Twitch keeps rejecting the bot login — reconnect the bot account from the dashboard",
        );
        stop("reauth");
        return;
      }
      events.onActivity("error", "Twitch rejected the bot's login — refreshing it");
      later(() => void bootstrap({ forceRefresh: true }), AUTH_RECOVERY_DELAY_MS);
    },
  });

  function connectWith(session: { channelName: string; botUsername: string; chatToken: string }) {
    currentChatToken = session.chatToken;
    currentChannelName = session.channelName;
    events.onIdentity({ channelName: session.channelName, botUsername: session.botUsername });
    client.connect({
      botUsername: session.botUsername,
      channelName: session.channelName,
      chatToken: session.chatToken,
    });
  }

  async function bootstrap(opts: { forceRefresh?: boolean } = {}): Promise<void> {
    try {
      // Validate against Twitch on startup too, not only hourly. forceRefresh
      // already mints a fresh token, so it skips the extra check.
      const session = await api.getSession({
        token,
        forceRefresh: opts.forceRefresh,
        revalidate: !opts.forceRefresh,
      });
      if (inactive()) return;
      retryAttempts = 0;
      notConfigured = false;
      wasLive = true;
      events.onPhase("live");
      connectWith(session);
      startRevalidateLoop();
    } catch (err) {
      if (inactive()) return;
      const kind = classifyBotError(err);
      // A malformed link (BAD_REQUEST) is as permanent as a revoked one.
      if (kind === "revoked" || kind === "invalid-link") {
        if (wasLive) {
          // Token rotated while we were running.
          enterRevoked();
        } else {
          // Bad link from the start — show nothing else (no details).
          revoked = true;
          events.onPhase("invalid");
          client.dispose();
        }
        return;
      }
      if (kind === "reauth") {
        stop("reauth");
        return;
      }
      if (kind === "no-account") {
        // No bot account (or owner) yet. Not an outage: poll slowly so the
        // page goes live once the streamer connects the bot.
        retryAttempts = 0;
        if (!notConfigured) {
          notConfigured = true;
          client.disconnect();
          events.onPhase("not-configured");
          events.onActivity(
            "info",
            "no bot account connected — connect one in Bot settings; checking every minute",
          );
        }
        later(() => void bootstrap(opts), NOT_CONFIGURED_POLL_MS);
        return;
      }
      const delay = retryDelayMs(retryAttempts, random);
      retryAttempts += 1;
      const reason = err instanceof Error ? err.message : "network error";
      events.onActivity(
        "error",
        `couldn't reach Dirework (${reason}) — retrying in ${Math.round(delay / 1000)}s`,
      );
      later(() => void bootstrap(opts), delay);
    }
  }

  function startRevalidateLoop(): void {
    if (revalidateTimer) return;
    revalidateTimer = setInterval(() => {
      if (inactive()) return;
      void revalidate();
    }, REVALIDATE_INTERVAL_MS);
  }

  async function revalidate(): Promise<void> {
    try {
      const session = await api.getSession({ token, revalidate: true });
      if (inactive()) return;
      // Only reconnect when the token rotated or the streamer renamed their
      // Twitch login — otherwise the socket is still valid and must not be
      // churned hourly.
      const tokenChanged = session.chatToken !== currentChatToken;
      if (tokenChanged || session.channelName !== currentChannelName) {
        events.onActivity(
          "info",
          tokenChanged ? "chat token refreshed — reconnecting" : "channel renamed — reconnecting",
        );
        connectWith(session);
      }
    } catch (err) {
      if (inactive()) return;
      const kind = classifyBotError(err);
      if (kind === "revoked" || kind === "invalid-link") {
        enterRevoked();
        return;
      }
      if (kind === "reauth") {
        // The live socket may still be authenticated, so keep it. If Twitch
        // later rejects it, the auth-failure path ends on the reauth screen.
        events.onActivity(
          "error",
          "couldn't refresh the bot login — reconnect the bot account in Bot settings",
        );
      }
      // Otherwise transient — the next hourly tick retries.
    }
  }

  events.onActivity("info", "bot console starting");
  void bootstrap();

  return {
    dispose() {
      disposed = true;
      for (const timer of pendingTimers) clearTimeout(timer);
      pendingTimers.clear();
      if (revalidateTimer) clearInterval(revalidateTimer);
      client.dispose();
    },
  };
}
