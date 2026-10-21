/**
 * Bot console session state machine, kept free of React so it can be tested
 * with fake timers. The bot page component maps its events onto state.
 *
 * Owns: getSession bootstrap (with startup + hourly Twitch validation), the
 * bounded auth-failure recovery loop, retry backoff, the "no bot account yet"
 * slow poll, and serialized chat ingest of Dirework commands only.
 *
 * Secrets: the chat token is handed straight to the IRC client and kept only
 * for the rotation comparison — never emitted in an event.
 */

import { isDireworkCommandLine } from "@dirework/api/chat-commands";
import { truncateToLength } from "@dirework/api/chat-text";

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
/**
 * Longest `message` bot.ingest accepts: its schema's `.max(600)` in
 * packages/api/src/routers/bot.ts, which counts UTF-16 code units. Twitch's
 * 500-character cap counts code points, so an emoji-heavy line (`!task` + 300
 * emoji = 606 code units) is valid chat yet fails that schema. The relay is
 * clamped to this, never splitting a surrogate pair, so it always parses.
 * Keep in step with the server schema.
 */
export const MAX_RELAYED_MESSAGE_LENGTH = 600;

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

export interface BotSessionInfo {
  channelName: string;
  botUsername: string;
  chatToken: string;
  /**
   * The instance's command alias keys, canonical (no "!"). Optional: an api
   * worker from before this field (rollback, or a split deploy) omits it.
   */
  aliases?: string[];
  /** The bot's mute switch. Optional for the same reason as `aliases`. */
  muted?: boolean;
}

export interface BotSessionApi {
  getSession(input: {
    token: string;
    forceRefresh?: boolean;
    revalidate?: boolean;
  }): Promise<BotSessionInfo>;
  /** `muted` is the state after the line ran; absent for clearchat and older api workers. */
  ingest(input: BotIngestInput): Promise<{ replies: string[]; muted?: boolean }>;
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
  /** Fired only when the mute switch changes (a mod's !mute/!unmute, or the dashboard). */
  onMuted(muted: boolean): void;
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
/**
 * Chat lines waiting on (or in) the serial ingest queue before new ones are
 * dropped. Each request is time-boxed at 30s, so a hung API would otherwise
 * pile up commands that replay minutes late — past the server's 5-minute
 * dedupe window, and against a state the viewer no longer sees (a stale !done
 * or !timer skip). 20 still absorbs a busy chat burst at a healthy API.
 */
export const MAX_PENDING_INGESTS = 20;

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
  // Alias keys from the latest getSession; refreshed on every revalidation.
  let aliasKeys: ReadonlySet<string> = new Set();
  // Starts unmuted (the console's default), so a normal startup logs nothing.
  let muted = false;
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
    // Queued before a revoke or dispose: the request would only 401 (or act
    // for a page that is gone) and burn a free-tier Worker request.
    if (inactive()) return [];
    try {
      const result = await api.ingest(input);
      // Every relayed line reports the mute state, so a mod's !mute shows here
      // without another request.
      applyMuted(result.muted);
      return result.replies;
    } catch (err) {
      if (classifyBotError(err) === "revoked") enterRevoked();
      else events.onActivity("error", "could not send that command to DireWork — message dropped");
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
  // Queued + in-flight ingests. Past the cap new lines are dropped and logged
  // once per backlog episode (until the queue fully drains), so a flood of
  // chat doesn't also flood the activity log.
  let pendingIngests = 0;
  let overflowLogged = false;
  const ingest = async (input: BotIngestInput): Promise<string[]> => {
    if (pendingIngests >= MAX_PENDING_INGESTS) {
      if (!overflowLogged) {
        overflowLogged = true;
        events.onActivity(
          "error",
          "DireWork is falling behind — dropping new chat commands until it catches up",
        );
      }
      return [];
    }
    pendingIngests += 1;
    try {
      return await runSerially(() => ingestOnce(input));
    } finally {
      pendingIngests -= 1;
      if (pendingIngests === 0) overflowLogged = false;
    }
  };

  const handleChat = (chat: IrcChatMessage) => {
    events.onCounter("seen");
    const text = chat.message.trim();
    // Relay only lines whose first word is a Dirework command or one of this
    // instance's aliases: plain chatter and other bots' commands (!lurk, !so)
    // would each cost a free-tier Worker request for nothing. The server still
    // decides what actually runs (disabled commands, permissions).
    if (!isDireworkCommandLine(text, aliasKeys)) return;
    const message = truncateToLength(text, MAX_RELAYED_MESSAGE_LENGTH);
    events.onCounter("commands");
    events.onActivity("chat", `${chat.displayName ?? chat.username}: ${text}`);
    void (async () => {
      const replies = await ingest({
        token,
        kind: "message",
        username: chat.username,
        displayName: chat.displayName,
        twitchId: chat.twitchId,
        message,
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
          "Twitch keeps rejecting the bot login — reconnect the bot account in Dashboard → Bot",
        );
        stop("reauth");
        return;
      }
      events.onActivity("error", "Twitch rejected the bot's login — refreshing it");
      later(() => void bootstrap({ forceRefresh: true }), AUTH_RECOVERY_DELAY_MS);
    },
  });

  function applyAliases(session: BotSessionInfo) {
    // Missing → no aliases yet: built-in commands still relay, and the bot
    // stays up instead of retrying a shape mismatch forever.
    aliasKeys = new Set(Array.isArray(session.aliases) ? session.aliases : []);
  }

  function applyMuted(next: boolean | undefined) {
    // Missing (clearchat, or an api worker from before the field) → unknown, keep the last state.
    if (typeof next !== "boolean" || next === muted) return;
    muted = next;
    events.onMuted(next);
    events.onActivity("info", next ? "bot muted — ignoring commands until !unmute" : "bot unmuted");
  }

  function connectWith(session: BotSessionInfo) {
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
      applyAliases(session);
      applyMuted(session.muted);
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
            "no bot account connected — connect one in Dashboard → Bot; checking every minute",
          );
        }
        later(() => void bootstrap(opts), NOT_CONFIGURED_POLL_MS);
        return;
      }
      const delay = retryDelayMs(retryAttempts, random);
      retryAttempts += 1;
      // Fixed copy: the feed is streamer-facing (often on stream), and a raw
      // err.message ("Failed to fetch", a tRPC message) explains nothing to them.
      events.onActivity(
        "error",
        `couldn't reach DireWork — retrying in ${Math.round(delay / 1000)}s`,
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
      // Alias edits on the dashboard reach a running page here (or on reload).
      applyAliases(session);
      applyMuted(session.muted);
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
          "couldn't refresh the bot login — reconnect the bot account in Dashboard → Bot",
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
