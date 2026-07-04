/**
 * Dependency-free Twitch IRC-over-WebSocket client for the browser bot page.
 *
 * Cloudflare Workers can't hold sockets, so the Dirework "bot" is a
 * token-gated web page (OBS browser source or pinned tab) that owns this
 * socket and relays chat lines to the stateless API.
 *
 * Pure class — no React, no environment access. The OAuth chat token lives in
 * memory only: it is written into the PASS frame and nowhere else (never
 * logged, never surfaced through callbacks).
 */

const TWITCH_IRC_URL = "wss://irc-ws.chat.twitch.tv:443";

/**
 * Minimum spacing between outbound PRIVMSGs. Twitch allows 20 messages / 30s
 * for a regular (non-verified) bot account — ~750ms spacing keeps us safely
 * under that without assuming verified-bot limits.
 */
const SEND_INTERVAL_MS = 750;

/** Twitch hard-caps chat messages at 500 characters. */
const MAX_SAY_LENGTH = 500;

const MAX_BACKOFF_MS = 30_000;

/** CTCP marker (0x01) wrapping "/me" ACTION messages. */
const ACTION_MARKER = String.fromCharCode(1);
const ACTION_PREFIX = `${ACTION_MARKER}ACTION `;

export type IrcStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "auth-failed"
  | "closed";

export interface IrcCredentials {
  botUsername: string;
  channelName: string;
  /** Twitch user access token for the bot account. Held in memory only. */
  chatToken: string;
}

/** A parsed PRIVMSG, shaped to match what `bot.ingest` expects. */
export interface IrcChatMessage {
  /** Login name (lowercase) from the message prefix. */
  username: string;
  /** `display-name` tag when present. */
  displayName?: string;
  /** `user-id` tag — always present on Twitch PRIVMSGs. */
  twitchId: string;
  message: string;
  /** `color` tag (e.g. "#FF0000") when the user has one set. */
  color?: string;
  isMod: boolean;
  isBroadcaster: boolean;
}

export interface IrcClientCallbacks {
  onStatus?: (status: IrcStatus) => void;
  onChat?: (message: IrcChatMessage) => void;
  /** CLEARCHAT with a target user (timeout/ban). Full chat clears are ignored. */
  onClearChat?: (targetUsername: string) => void;
  onError?: (message: string) => void;
  /**
   * Twitch rejected the login ("Login authentication failed" NOTICE). The
   * client stops auto-reconnecting; the owner should fetch a fresh chat token
   * (bot.getSession) and call connect() again with new credentials.
   */
  onAuthFailure?: () => void;
}

export interface ParsedIrcLine {
  tags: Record<string, string>;
  prefix: string;
  command: string;
  params: string[];
  trailing: string | null;
}

/** IRCv3 tag value unescaping: \: → ; \s → space \\ → \ \r \n → CR LF. */
function unescapeTagValue(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    i++;
    switch (next) {
      case ":":
        out += ";";
        break;
      case "s":
        out += " ";
        break;
      case "\\":
        out += "\\";
        break;
      case "r":
        out += "\r";
        break;
      case "n":
        out += "\n";
        break;
      case undefined:
        // Trailing lone backslash — dropped per spec.
        break;
      default:
        out += next;
    }
  }
  return out;
}

/** Parse one raw IRC line: `[@tags ][:prefix ]COMMAND[ params][ :trailing]`. */
export function parseIrcLine(raw: string): ParsedIrcLine {
  let rest = raw;
  const tags: Record<string, string> = {};
  let prefix = "";
  let trailing: string | null = null;

  if (rest.startsWith("@")) {
    const space = rest.indexOf(" ");
    const rawTags = rest.slice(1, space === -1 ? rest.length : space);
    rest = space === -1 ? "" : rest.slice(space + 1);
    for (const pair of rawTags.split(";")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq === -1) {
        tags[pair] = "";
      } else {
        tags[pair.slice(0, eq)] = unescapeTagValue(pair.slice(eq + 1));
      }
    }
  }

  if (rest.startsWith(":")) {
    const space = rest.indexOf(" ");
    prefix = rest.slice(1, space === -1 ? rest.length : space);
    rest = space === -1 ? "" : rest.slice(space + 1);
  }

  const trailingIdx = rest.indexOf(" :");
  if (trailingIdx !== -1) {
    trailing = rest.slice(trailingIdx + 2);
    rest = rest.slice(0, trailingIdx);
  }

  const parts = rest.split(" ").filter(Boolean);
  const command = parts[0] ?? "";
  const params = parts.slice(1);

  return { tags, prefix, command, params, trailing };
}

/** NOTICE texts that mean the PASS token was rejected (not transient). */
function isAuthFailureNotice(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("login authentication failed") ||
    t.includes("improperly formatted auth") ||
    t.includes("login unsuccessful") ||
    t.includes("invalid nick")
  );
}

export class TwitchIrcClient {
  private readonly callbacks: IrcClientCallbacks;
  private creds: IrcCredentials | null = null;
  private ws: WebSocket | null = null;
  /** Monotonic socket generation — stale sockets' handlers no-op. */
  private generation = 0;
  private status: IrcStatus = "idle";
  private disposed = false;
  private authFailed = false;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Outbound PRIVMSG queue, throttled to one message per SEND_INTERVAL_MS. */
  private sendQueue: string[] = [];
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSentAt = 0;
  private joined = false;

  constructor(callbacks: IrcClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  getStatus(): IrcStatus {
    return this.status;
  }

  /**
   * Connect (or reconnect with fresh credentials after an auth failure).
   * Replaces any existing socket and resets backoff.
   */
  connect(creds: IrcCredentials): void {
    if (this.disposed) return;
    this.creds = creds;
    this.authFailed = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.openSocket("connecting");
  }

  /** Intentional shutdown — no reconnect. Queue is dropped. */
  disconnect(): void {
    this.clearReconnectTimer();
    this.clearSendTimer();
    this.sendQueue = [];
    this.closeSocket();
    this.setStatus("closed");
  }

  /** Terminal disconnect — the instance cannot be reused afterwards. */
  dispose(): void {
    this.disconnect();
    this.disposed = true;
  }

  /** Queue a chat message; sent as PRIVMSG with rate-limit throttling. */
  say(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.disposed) return;
    this.sendQueue.push(trimmed.slice(0, MAX_SAY_LENGTH));
    this.scheduleSend();
  }

  // ---------------------------------------------------------------- internal

  private setStatus(next: IrcStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatus?.(next);
  }

  private openSocket(statusWhileOpening: "connecting" | "reconnecting"): void {
    if (!this.creds || this.disposed) return;
    this.closeSocket();
    this.setStatus(statusWhileOpening);

    const gen = ++this.generation;
    let ws: WebSocket;
    try {
      ws = new WebSocket(TWITCH_IRC_URL);
    } catch {
      this.callbacks.onError?.("Failed to open WebSocket to Twitch IRC");
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      if (gen !== this.generation || !this.creds) return;
      // Capabilities first, then authenticate. The PASS frame is the only
      // place the chat token is ever written — never log outbound frames.
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`PASS oauth:${this.creds.chatToken}`);
      ws.send(`NICK ${this.creds.botUsername.toLowerCase()}`);
    };

    ws.onmessage = (event) => {
      if (gen !== this.generation) return;
      const data: unknown = event.data;
      if (typeof data !== "string") return;
      // Frames may batch multiple CRLF-terminated lines.
      for (const line of data.split("\r\n")) {
        if (line.length > 0) this.handleLine(line);
      }
    };

    ws.onclose = () => {
      if (gen !== this.generation) return;
      this.ws = null;
      this.joined = false;
      if (this.disposed || this.authFailed) return;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      if (gen !== this.generation) return;
      this.callbacks.onError?.("WebSocket error");
      // onclose fires after onerror and owns the reconnect.
    };
  }

  private handleLine(raw: string): void {
    const msg = parseIrcLine(raw);

    switch (msg.command) {
      case "PING":
        // Reply promptly (even while backgrounded) or Twitch drops us.
        this.sendRaw(`PONG :${msg.trailing ?? "tmi.twitch.tv"}`);
        break;

      case "001":
        // Welcome — login accepted. Join, reset backoff, flush queued sends.
        this.reconnectAttempts = 0;
        if (this.creds) {
          this.sendRaw(`JOIN #${this.creds.channelName.toLowerCase()}`);
        }
        this.joined = true;
        this.setStatus("connected");
        this.scheduleSend();
        break;

      case "PRIVMSG":
        this.handlePrivmsg(msg);
        break;

      case "CLEARCHAT": {
        // Trailing = target user (timeout/ban). No trailing = full chat
        // clear, which has no per-user meaning for us — ignored.
        const target = msg.trailing?.trim();
        if (target) this.callbacks.onClearChat?.(target.toLowerCase());
        break;
      }

      case "NOTICE": {
        const text = msg.trailing ?? "";
        if (isAuthFailureNotice(text)) {
          // Token rejected — stop reconnecting and hand control to the owner
          // so it can fetch a fresh token and call connect() again.
          this.authFailed = true;
          this.setStatus("auth-failed");
          this.closeSocket();
          this.callbacks.onAuthFailure?.();
        } else {
          this.callbacks.onError?.(`NOTICE: ${text}`);
        }
        break;
      }

      case "RECONNECT":
        // Twitch is restarting this edge server — reconnect immediately with
        // the same credentials.
        this.openSocket("reconnecting");
        break;

      default:
        // CAP ACK, 002-376 numerics, JOIN echo, USERSTATE, … — no action.
        break;
    }
  }

  private handlePrivmsg(msg: ParsedIrcLine): void {
    const username = msg.prefix.split("!")[0]?.toLowerCase() ?? "";
    let text = msg.trailing ?? "";

    // "/me" messages arrive as \x01ACTION <text>\x01 — unwrap.
    if (text.startsWith(ACTION_PREFIX) && text.endsWith(ACTION_MARKER)) {
      text = text.slice(ACTION_PREFIX.length, -1);
    }

    const twitchId = msg.tags["user-id"];
    if (!username || !twitchId || !text) return;

    // Defensive: never react to the bot's own lines. Twitch doesn't echo
    // PRIVMSGs back, but a streamer chatting from the bot account would loop.
    if (this.creds && username === this.creds.botUsername.toLowerCase()) return;

    const badges = msg.tags["badges"] ?? "";
    const isBroadcaster = badges.includes("broadcaster/");
    const isMod = msg.tags["mod"] === "1" || badges.includes("moderator/");

    this.callbacks.onChat?.({
      username,
      displayName: msg.tags["display-name"] || undefined,
      twitchId,
      message: text,
      color: msg.tags["color"] || undefined,
      isMod,
      isBroadcaster,
    });
  }

  /** Low-level frame send for control messages (PONG/JOIN) — not throttled. */
  private sendRaw(line: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(line);
    }
  }

  private scheduleSend(): void {
    if (this.sendTimer || this.sendQueue.length === 0) return;
    const wait = Math.max(0, this.lastSentAt + SEND_INTERVAL_MS - Date.now());
    this.sendTimer = setTimeout(() => {
      this.sendTimer = null;
      this.flushOne();
    }, wait);
  }

  private flushOne(): void {
    if (this.sendQueue.length === 0) return;
    if (
      !this.creds ||
      !this.joined ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      // Not ready — keep the queue; the 001 handler re-schedules on rejoin.
      return;
    }
    const text = this.sendQueue.shift();
    if (text === undefined) return;
    this.sendRaw(`PRIVMSG #${this.creds.channelName.toLowerCase()} :${text}`);
    this.lastSentAt = Date.now();
    if (this.sendQueue.length > 0) this.scheduleSend();
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.authFailed || !this.creds) return;
    if (this.reconnectTimer) return;
    this.setStatus("reconnecting");
    // Exponential backoff 1s → 2s → 4s → … capped at 30s, plus jitter so a
    // fleet of restarting pages doesn't stampede Twitch in lockstep.
    const base = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    const delay = base + Math.floor(Math.random() * 500);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket("reconnecting");
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearSendTimer(): void {
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }
  }

  private closeSocket(): void {
    const ws = this.ws;
    this.ws = null;
    this.joined = false;
    if (!ws) return;
    // Invalidate the old socket's handlers before closing so its onclose
    // can't trigger a competing reconnect.
    this.generation++;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    try {
      ws.close();
    } catch {
      // Already closed/closing.
    }
  }
}
