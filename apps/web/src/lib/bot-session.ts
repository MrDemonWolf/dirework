/**
 * Bot console session state machine, kept free of React so it can be tested
 * with fake timers. The bot page component maps its events onto state.
 *
 * Owns: getSession bootstrap (with startup + hourly Twitch validation), the
 * bounded auth-failure recovery loop, retry backoff, the "no bot account yet"
 * slow poll, the one-bot-page lease (claim before joining chat, a heartbeat
 * every BOT_HEARTBEAT_MS, standby + take over), serialized chat ingest of
 * Dirework commands only, with a per-viewer flood brake (viewer-throttle.ts),
 * and delayed ban cleanup (BAN_CLEANUP_DELAY_MS after a ban, cancelled by the viewer
 * chatting again or a timeout replacing it; timeouts alone never remove tasks).
 *
 * Secrets: the chat token is handed straight to the IRC client and kept only
 * for the rotation comparison — never emitted in an event.
 */

import { BAN_CLEANUP_DELAY_MS } from "@dirework/api/bot-permissions";
import { isDireworkCommandLine } from "@dirework/api/chat-commands";
import { MAX_RELAYED_MESSAGE_LENGTH, truncateToLength } from "@dirework/api/chat-text";

import type { DockCommandResult } from "./bot-dock-commands";
import { classifyBotError } from "./bot-session-errors";
import type {
  IrcChatMessage,
  IrcClearChat,
  IrcClientCallbacks,
  IrcCredentials,
  IrcStatus,
} from "./irc-client";
import { BOT_HEARTBEAT_MS } from "./poll-intervals";
import { createSerialQueue } from "./serial-queue";
import { createViewerThrottle } from "./viewer-throttle";

/**
 * - `not-configured`: no bot account (or owner) yet — keeps polling slowly so
 *   connecting the bot from the dashboard picks up without reloading OBS.
 * - `standby`: another open bot page holds the chat lease, so this one stays
 *   off IRC. It checks the lease every BOT_HEARTBEAT_MS and takes over once the
 *   other page stops renewing it (closed), or at once on `takeOver()`.
 * - `invalid`: the bot link was never valid. `revoked`: it was reset.
 * - `reauth`: the link is fine but the bot's Twitch login can no longer be
 *   refreshed (or Twitch kept rejecting it) — reconnect the bot account.
 */
export type BotPhase =
  | "boot"
  | "live"
  | "standby"
  | "not-configured"
  | "invalid"
  | "revoked"
  | "reauth";

export type BotActivityKind = "info" | "chat" | "reply" | "error";

export type BotCounter = "seen" | "commands" | "replies";

/** Logged when DireWork's API refused or failed one relayed command. */
export const INGEST_DROPPED_MESSAGE = "could not send that command to DireWork — message dropped";
/** Logged once per backlog episode when the ingest queue is full. */
export const INGEST_BACKLOG_MESSAGE =
  "DireWork is falling behind — dropping new chat commands until it catches up";

/**
 * Whether an error came from relaying commands to DireWork rather than from the IRC socket. A
 * new IRC connection says nothing about the API, so only `onIngestHealthy` clears one.
 */
export function isIngestError(message: string): boolean {
  return message === INGEST_DROPPED_MESSAGE || message === INGEST_BACKLOG_MESSAGE;
}

/**
 * Logged when the hourly revalidation finds the bot's Twitch login can no longer be refreshed
 * while the live socket still works. A reply or a new socket says nothing about the refresh
 * credentials, so only `onSessionRefreshed` (a later getSession that succeeds) clears it.
 */
export const BOT_LOGIN_REFRESH_FAILED_MESSAGE =
  "couldn't refresh the bot login — reconnect the bot account in Dashboard → Bot";

export function isLoginRefreshError(message: string): boolean {
  return message === BOT_LOGIN_REFRESH_FAILED_MESSAGE;
}

export type BotIngestInput =
  | {
      token: string;
      /** This page's lease id: the server refuses a page another one took over from. */
      instanceId: string;
      kind: "message";
      username: string;
      displayName?: string;
      twitchId: string;
      message: string;
      color?: string;
      isMod: boolean;
      /** IRC badges for "Who can add tasks". Absent from the dock's own lines. */
      isVip?: boolean;
      isSubscriber?: boolean;
      /** IRC message id; the server dedupes on it when two bot pages relay the same line. */
      messageId?: string;
    }
  | {
      token: string;
      instanceId: string;
      kind: "clearchat";
      targetUsername: string;
    };

/** What `bot.ingest` reports for a ban cleanup (absent from an older api worker). */
export interface BanCleanupResult {
  removed: number;
}

export interface BotLeaseInput {
  token: string;
  instanceId: string;
  /** Force the lease to this page (the dock's "Take over"). */
  takeover?: boolean;
}

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
  /**
   * The channel owner's Twitch user id, which `bot.ingest` matches to grant broadcaster
   * privileges. The dock's command buttons send their lines as this user. Optional (and
   * null when the owner's id is unknown): without it the buttons stay off.
   */
  broadcasterId?: string | null;
}

export interface BotSessionApi {
  getSession(input: {
    token: string;
    forceRefresh?: boolean;
    revalidate?: boolean;
  }): Promise<BotSessionInfo>;
  /** `muted` is the state after the line ran; absent for clearchat and older api workers. */
  ingest(
    input: BotIngestInput,
  ): Promise<{ replies: string[]; muted?: boolean; banCleanup?: BanCleanupResult }>;
  /** Take or renew the chat lease; `holder: false` means another page holds it. */
  heartbeat(input: BotLeaseInput): Promise<{ holder: boolean }>;
  /** Give the lease up as the page closes. Fire-and-forget: the page is going away. */
  release(input: { token: string; instanceId: string }): void;
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
  /** `commandsReady`: the session knows the broadcaster, so the dock's buttons can run. */
  onIdentity(identity: { channelName: string; botUsername: string; commandsReady: boolean }): void;
  /** Fired on every clean IRC connect. */
  onConnected(): void;
  onCounter(counter: BotCounter): void;
  onActivity(kind: BotActivityKind, text: string): void;
  /**
   * The ingest queue drained and its last command reached DireWork: commands are flowing again,
   * so an earlier ingest error no longer holds.
   */
  onIngestHealthy(): void;
  /** A reply left the IRC send queue for Twitch (not when it was queued: see `onSent`). */
  onReplySent(): void;
  /**
   * A getSession call (startup, recovery or the hourly revalidation) succeeded, so the bot's
   * Twitch login refreshes again and an earlier login-refresh error no longer holds.
   */
  onSessionRefreshed(): void;
  /** Fired only when the mute switch changes (a mod's !mute/!unmute, or the dashboard). */
  onMuted(muted: boolean): void;
}

export interface BotSessionOptions {
  token: string;
  /**
   * This page load's lease id (crypto.randomUUID once per load). The dock's Reconnect keeps
   * it, so a restarted session renews its own lease instead of waiting on itself.
   */
  instanceId: string;
  api: BotSessionApi;
  createClient: (callbacks: IrcClientCallbacks) => BotIrcClient;
  events: BotSessionEvents;
  /** Jitter source, injectable for tests. */
  random?: () => number;
  /** Synthetic message ids for dock commands, injectable for tests. */
  newMessageId?: () => string;
}

export interface BotSession {
  dispose(): void;
  /**
   * Run one command line from the dock's buttons as the channel broadcaster, through the
   * same serialized `bot.ingest` path chat uses. The replies come back to the caller and
   * are NOT posted to Twitch chat. One request per call; never retried.
   */
  runCommand(line: string): Promise<DockCommandResult>;
  /**
   * In standby, force the lease to this page and go live (one getSession + one heartbeat).
   * The page that held it sees it lost on its next heartbeat or relayed command and stands by.
   */
  takeOver(): void;
  /** The page is closing: give the lease up if this session holds it. */
  release(): void;
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

/** Logged when a timeout arrives: timeouts never remove tasks. */
export function timeoutKeptMessage(login: string): string {
  return `${login} was timed out — their tasks stay`;
}

/** Logged when a ban arrives and its cleanup is scheduled. */
export function banScheduledMessage(login: string): string {
  return `${login} was banned — removing their tasks in ${Math.round(BAN_CLEANUP_DELAY_MS / 60_000)} minutes unless they're unbanned`;
}

/** Logged when a banned viewer chats again before the cleanup ran: they were unbanned. */
export function banCancelledMessage(login: string): string {
  return `${login} is chatting again — keeping their tasks`;
}

/** Logged when a timeout replaces a pending ban (the mod unbanned, then timed them out). */
export function banReplacedByTimeoutMessage(login: string): string {
  return `${login}'s ban became a timeout — keeping their tasks`;
}

/** Logged when a ban cleanup ran (the server's count, when it gave one). */
export function banCleanupMessage(login: string, result: BanCleanupResult | undefined): string {
  if (!result) return `ban cleanup sent for ${login}`;
  return result.removed > 0
    ? `removed ${login}'s tasks after their ban`
    : `${login} had no tasks to remove after their ban`;
}

/** Logged once per burst when a viewer's commands start being dropped by the throttle. */
export function viewerThrottledMessage(name: string): string {
  return `${name} is sending commands too fast — ignoring them for a moment`;
}

/** Capped exponential backoff with ±20% jitter so many tabs don't retry in lockstep. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  return Math.round(base * (0.8 + random() * 0.4));
}

export function createBotSession({
  token,
  instanceId,
  api,
  createClient,
  events,
  random = Math.random,
  newMessageId = () => crypto.randomUUID(),
}: BotSessionOptions): BotSession {
  let disposed = false;
  let revoked = false;
  let wasLive = false;
  let notConfigured = false;
  let currentChatToken: string | null = null;
  let currentChannelName: string | null = null;
  // The owner's Twitch id from the latest getSession: the dock's buttons speak as them.
  let broadcasterId: string | null = null;
  // Alias keys from the latest getSession; refreshed on every revalidation.
  let aliasKeys: ReadonlySet<string> = new Set();
  // Starts unmuted (the console's default), so a normal startup logs nothing.
  let muted = false;
  // Whether this session has reported a mute state yet. The first known state is always
  // reported, even "unmuted": the dock's Reconnect replaces the session without remounting
  // the page, and the page may still show the old session's "Muted".
  let mutedReported = false;
  let authRecoveryAttempts = 0;
  let retryAttempts = 0;
  let revalidateTimer: ReturnType<typeof setInterval> | null = null;
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  // The chat lease: standing by (off IRC) while another page holds it. `leaseEpoch` bumps on
  // every live/standby switch, so a heartbeat answer that crossed one is ignored.
  let standby = false;
  let holdsLease = false;
  let leaseEpoch = 0;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  const inactive = () => disposed || revoked;
  const viewerThrottle = createViewerThrottle();
  // Ban cleanups waiting out BAN_CLEANUP_DELAY_MS, by login. A repeat ban of the same viewer
  // keeps the first timer; the viewer chatting again cancels it. Cleared on dispose, so a
  // page closed inside the window never runs it.
  const pendingBans = new Map<string, ReturnType<typeof setTimeout>>();

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
    clearHeartbeat();
    events.onPhase(next);
    client.dispose();
  };
  const enterRevoked = () => stop("revoked");

  function clearHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }

  /** The next lease check-in, live or in standby. Only one is ever pending. */
  function scheduleHeartbeat() {
    clearHeartbeat();
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null;
      if (!inactive()) void heartbeat();
    }, BOT_HEARTBEAT_MS);
  }

  /**
   * Another page holds the chat: leave IRC and check the lease every BOT_HEARTBEAT_MS
   * (taking over once it expires). No getSession, no hourly revalidation meanwhile.
   */
  function enterStandby() {
    if (inactive() || standby) return;
    standby = true;
    holdsLease = false;
    leaseEpoch += 1;
    client.disconnect();
    events.onPhase("standby");
    events.onActivity("info", "the bot is running in another bot page — standing by");
    scheduleHeartbeat();
  }

  async function heartbeat(): Promise<void> {
    const epoch = leaseEpoch;
    let holder: boolean;
    try {
      ({ holder } = await api.heartbeat({ token, instanceId }));
    } catch (err) {
      if (inactive() || epoch !== leaseEpoch) return;
      const kind = classifyBotError(err);
      if (kind === "revoked" || kind === "invalid-link") {
        enterRevoked();
        return;
      }
      // Transient: keep the current state and check again next tick. A live page keeps its
      // chat (a missed check-in is what the 5-minute lease absorbs).
      scheduleHeartbeat();
      return;
    }
    if (inactive() || epoch !== leaseEpoch) return;
    if (standby && holder) {
      // The other page stopped renewing (closed): this one now holds the lease, so go live.
      events.onActivity("info", "the other bot page stopped — taking over");
      void bootstrap({ claimed: true });
      return;
    }
    if (!standby && !holder) {
      enterStandby();
      return;
    }
    scheduleHeartbeat();
  }

  /**
   * Claim the lease before joining chat. Resolves false when another page holds it, null
   * when the bot link was reset. A failed request fails OPEN (true): an api blip, or an api
   * worker from before the lease, must not keep the only bot page off chat; its next
   * heartbeat settles who holds it.
   */
  async function claimLease(takeover: boolean): Promise<boolean | null> {
    try {
      const { holder } = await api.heartbeat({
        token,
        instanceId,
        takeover: takeover || undefined,
      });
      return holder;
    } catch (err) {
      const kind = classifyBotError(err);
      if (kind === "revoked" || kind === "invalid-link") return null;
      return true;
    }
  }

  /**
   * Relay one chat line to the stateless API. Mutations are deliberately not
   * retried: if D1 commits but the response is lost, an automatic retry would
   * apply commands such as !done, !next, or !timer skip twice.
   */
  // Whether the most recent ingest (they run one at a time) reached DireWork.
  let lastIngestOk = false;
  type IngestResult = Awaited<ReturnType<BotSessionApi["ingest"]>>;
  const ingestOnce = async (
    input: BotIngestInput,
    onResult?: (result: IngestResult) => void,
  ): Promise<string[]> => {
    // Queued before a revoke or dispose: the request would only 401 (or act
    // for a page that is gone) and burn a free-tier Worker request.
    if (inactive()) return [];
    try {
      const result = await api.ingest(input);
      lastIngestOk = true;
      onResult?.(result);
      // Every relayed line reports the mute state, so a mod's !mute shows here
      // without another request.
      applyMuted(result.muted);
      return result.replies;
    } catch (err) {
      lastIngestOk = false;
      const kind = classifyBotError(err);
      if (kind === "revoked") enterRevoked();
      // Another page took the chat over: this one must stop relaying now, not at its next
      // heartbeat.
      else if (kind === "standby") enterStandby();
      else events.onActivity("error", INGEST_DROPPED_MESSAGE);
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
  const ingest = async (
    input: BotIngestInput,
    onResult?: (result: IngestResult) => void,
  ): Promise<string[]> => {
    if (pendingIngests >= MAX_PENDING_INGESTS) {
      if (!overflowLogged) {
        overflowLogged = true;
        events.onActivity("error", INGEST_BACKLOG_MESSAGE);
      }
      return [];
    }
    pendingIngests += 1;
    try {
      return await runSerially(() => ingestOnce(input, onResult));
    } finally {
      pendingIngests -= 1;
      if (pendingIngests === 0) {
        overflowLogged = false;
        if (lastIngestOk && !inactive()) events.onIngestHealthy();
      }
    }
  };

  /** Run one ban cleanup now: nothing undid the ban during the grace period. */
  const runBanCleanup = async (login: string) => {
    if (inactive() || standby) return;
    const result = await ingestOnceForBan({
      token,
      instanceId,
      kind: "clearchat",
      targetUsername: login,
    });
    if (result === null || inactive()) return;
    events.onActivity("info", banCleanupMessage(login, result));
  };

  /** Drop a pending cleanup; true when there was one. */
  const cancelPendingBan = (login: string): boolean => {
    const timer = pendingBans.get(login);
    if (!timer) return false;
    clearTimeout(timer);
    pendingBans.delete(login);
    return true;
  };

  const handleClearChat = (clear: IrcClearChat) => {
    const login = clear.targetUsername;
    if (!clear.permanent) {
      // A timeout replaces whatever came before it: a ban the mod lifted and turned into a
      // timeout must not still remove the viewer's tasks when its timer fires.
      events.onActivity(
        "info",
        cancelPendingBan(login) ? banReplacedByTimeoutMessage(login) : timeoutKeptMessage(login),
      );
      return;
    }
    if (pendingBans.has(login)) return;
    events.onActivity("info", banScheduledMessage(login));
    const timer = setTimeout(() => {
      pendingBans.delete(login);
      void runBanCleanup(login);
    }, BAN_CLEANUP_DELAY_MS);
    pendingBans.set(login, timer);
  };

  /**
   * The ban cleanup's ingest: same serial queue and backlog cap as chat, but it keeps the
   * server's report. Null when it never reached DireWork.
   */
  async function ingestOnceForBan(
    input: Extract<BotIngestInput, { kind: "clearchat" }>,
  ): Promise<BanCleanupResult | undefined | null> {
    let report: BanCleanupResult | undefined | null = null;
    await ingest(input, (result) => {
      report = result.banCleanup;
    });
    return report;
  }

  const handleChat = (chat: IrcChatMessage) => {
    events.onCounter("seen");
    // A banned viewer can't chat: a line from one waiting on cleanup means they were unbanned.
    if (cancelPendingBan(chat.username)) {
      events.onActivity("info", banCancelledMessage(chat.username));
    }
    const text = chat.message.trim();
    // Relay only lines whose first word is a Dirework command or one of this
    // instance's aliases: plain chatter and other bots' commands (!lurk, !so)
    // would each cost a free-tier Worker request for nothing. The server still
    // decides what actually runs (disabled commands, permissions).
    if (!isDireworkCommandLine(text, aliasKeys)) return;
    // Per-viewer flood brake, before any request: past VIEWER_COMMAND_LIMIT commands
    // in VIEWER_COMMAND_WINDOW_MS a viewer's lines are dropped here, so spam costs
    // no Worker request or D1 read. Never the broadcaster or a mod.
    if (!chat.isBroadcaster && !chat.isMod) {
      const verdict = viewerThrottle.check(chat.twitchId);
      if (verdict === "throttled") {
        events.onActivity("info", viewerThrottledMessage(chat.displayName ?? chat.username));
      }
      if (verdict !== "allowed") return;
    }
    // Clamp to bot.ingest's own cap so the relay always passes its schema (a
    // rejected line would drop the command with no reply). truncateToLength
    // counts UTF-16 units and never splits an emoji; zod counts code points,
    // never more than units, so the clamped line always fits.
    const message = truncateToLength(text, MAX_RELAYED_MESSAGE_LENGTH);
    events.onCounter("commands");
    events.onActivity("chat", `${chat.displayName ?? chat.username}: ${text}`);
    void (async () => {
      const replies = await ingest({
        token,
        instanceId,
        kind: "message",
        username: chat.username,
        displayName: chat.displayName,
        twitchId: chat.twitchId,
        message,
        color: chat.color,
        isMod: chat.isMod,
        isVip: chat.isVip,
        isSubscriber: chat.isSubscriber,
        messageId: chat.messageId,
      });
      // Standing by now: the page that took over answers chat.
      if (inactive() || standby) return;
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
    onClearChat: (clear) => {
      if (inactive()) return;
      handleClearChat(clear);
    },
    onError: (message) => {
      if (inactive()) return;
      events.onActivity("error", message);
    },
    onSent: () => {
      if (inactive()) return;
      events.onReplySent();
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
    if (typeof next !== "boolean" || (next === muted && mutedReported)) return;
    const changed = next !== muted;
    muted = next;
    mutedReported = true;
    events.onMuted(next);
    if (changed) {
      events.onActivity(
        "info",
        next ? "bot muted — ignoring commands until !unmute" : "bot unmuted",
      );
    }
  }

  function connectWith(session: BotSessionInfo) {
    currentChatToken = session.chatToken;
    currentChannelName = session.channelName;
    broadcasterId = session.broadcasterId ?? null;
    events.onIdentity({
      channelName: session.channelName,
      botUsername: session.botUsername,
      commandsReady: broadcasterId !== null,
    });
    client.connect({
      botUsername: session.botUsername,
      channelName: session.channelName,
      chatToken: session.chatToken,
    });
  }

  /**
   * `takeover`: force the chat lease to this page (the dock's button). `claimed`: a standby
   * heartbeat already took the lease, so skip the claim.
   */
  async function bootstrap(
    opts: { forceRefresh?: boolean; takeover?: boolean; claimed?: boolean } = {},
  ): Promise<void> {
    try {
      // Validate against Twitch on startup too, not only hourly. forceRefresh
      // already mints a fresh token, so it skips the extra check.
      const session = await api.getSession({
        token,
        forceRefresh: opts.forceRefresh,
        revalidate: !opts.forceRefresh,
      });
      if (inactive()) return;
      events.onSessionRefreshed();
      retryAttempts = 0;
      notConfigured = false;
      // One bot page on chat at a time: claim the lease before joining. Only once a session
      // exists, so a page with no bot account yet never holds it.
      if (!opts.claimed) {
        const holder = await claimLease(opts.takeover === true);
        if (inactive()) return;
        if (holder === null) {
          // getSession accepted the link a moment ago, so it was reset just now.
          enterRevoked();
          return;
        }
        if (!holder) {
          enterStandby();
          return;
        }
      }
      standby = false;
      holdsLease = true;
      leaseEpoch += 1;
      scheduleHeartbeat();
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
      // Standing by holds no chat token worth checking; taking over fetches a fresh one.
      if (inactive() || standby) return;
      void revalidate();
    }, REVALIDATE_INTERVAL_MS);
  }

  async function revalidate(): Promise<void> {
    try {
      const session = await api.getSession({ token, revalidate: true });
      if (inactive() || standby) return;
      events.onSessionRefreshed();
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
        events.onActivity("error", BOT_LOGIN_REFRESH_FAILED_MESSAGE);
      }
      // Otherwise transient — the next hourly tick retries.
    }
  }

  events.onActivity("info", "bot console starting");
  void bootstrap();

  async function runCommand(line: string): Promise<DockCommandResult> {
    if (
      inactive() ||
      standby ||
      !wasLive ||
      notConfigured ||
      !broadcasterId ||
      !currentChannelName
    ) {
      return { ok: false, reason: "not-ready" };
    }
    const input: BotIngestInput = {
      token,
      instanceId,
      kind: "message",
      // The streamer's own login and id: the server derives broadcaster (and so mod)
      // privileges from the id, exactly as for a line they typed in chat.
      username: currentChannelName,
      twitchId: broadcasterId,
      message: line,
      // Not claimed: the server grants mod rights because the id is the broadcaster's.
      isMod: false,
      // Unique per click, so the server's processed_chat_message claim runs it once.
      messageId: newMessageId(),
    };
    events.onActivity("chat", `dock: ${line}`);
    // Same queue as chat, so a click and a chat command never interleave.
    return runSerially(async (): Promise<DockCommandResult> => {
      if (inactive()) return { ok: false, reason: "not-ready" };
      try {
        const result = await api.ingest(input);
        applyMuted(result.muted);
        // Shown in the dock only. Posting them would announce the streamer's own clicks.
        for (const reply of result.replies) events.onActivity("reply", `→ (dock) ${reply}`);
        return { ok: true, replies: result.replies };
      } catch (err) {
        const kind = classifyBotError(err);
        if (kind === "revoked") {
          enterRevoked();
          return { ok: false, reason: "not-ready" };
        }
        if (kind === "standby") {
          enterStandby();
          return { ok: false, reason: "not-ready" };
        }
        events.onActivity("error", `couldn't send ${line} to DireWork`);
        return { ok: false, reason: "failed" };
      }
    });
  }

  function takeOver(): void {
    // Leaving standby here also makes a second click a no-op.
    if (inactive() || !standby) return;
    standby = false;
    clearHeartbeat();
    leaseEpoch += 1; // a heartbeat already in flight must not undo the takeover
    events.onPhase("boot");
    events.onActivity("info", "taking over from the other bot page");
    void bootstrap({ takeover: true });
  }

  return {
    runCommand,
    takeOver,
    release() {
      if (inactive() || !holdsLease) return;
      holdsLease = false;
      api.release({ token, instanceId });
    },
    dispose() {
      disposed = true;
      for (const timer of pendingTimers) clearTimeout(timer);
      pendingTimers.clear();
      for (const timer of pendingBans.values()) clearTimeout(timer);
      pendingBans.clear();
      clearHeartbeat();
      if (revalidateTimer) clearInterval(revalidateTimer);
      client.dispose();
    },
  };
}
