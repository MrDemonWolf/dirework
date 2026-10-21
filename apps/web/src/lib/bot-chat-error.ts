// The bot page's "latest chat error" banner state. Pure (time passed in), so the page can
// derive it from the bot session's events and the 1s uptime tick: no extra timers, no
// change to the session state machine.

import { isIngestError } from "./bot-session";
import { isChatRejection } from "./irc-client";

/**
 * How long a sent reply must go unanswered by a new error before a reply-cleared error goes
 * away. Twitch never acknowledges a delivered PRIVMSG; it only answers a rejected one with a
 * NOTICE (banned, slow mode, followers-only), which lands within a second or two of the send.
 * The window starts when the IRC client actually writes the reply (`onSent`), not when it is
 * queued, so a reply held by the rate limiter or a reconnect can't clear the banner early.
 */
export const REPLY_CLEAR_GRACE_MS = 10_000;

export interface ChatErrorEntry {
  message: string;
  /** When the error was reported. */
  at: number;
  /** When the first reply after the error was sent, or null while none has been. */
  replyAt: number | null;
}

/**
 * One slot per cause, each with its own clear rule, so clearing one never hides another that
 * still holds:
 * - `rejection`: Twitch refused a reply (ban, timeout, chat mode). It belongs to the channel,
 *   survives a reconnect, and clears once a later reply goes unrefused.
 * - `ingest`: DireWork dropped a command, or the ingest queue backed up. IRC knows nothing
 *   about it; it clears only when the session reports ingest healthy again.
 * - `connection`: anything else (the socket, the watchdog, a login refresh). A fresh connect
 *   or a reply that goes through clears it, and it never hides a durable error.
 */
export interface ChatErrorState {
  rejection: ChatErrorEntry | null;
  ingest: ChatErrorEntry | null;
  connection: ChatErrorEntry | null;
}

type Slot = keyof ChatErrorState;

const EMPTY: ChatErrorState = { rejection: null, ingest: null, connection: null };

function slotFor(message: string): Slot {
  if (isChatRejection(message)) return "rejection";
  if (isIngestError(message)) return "ingest";
  return "connection";
}

/** The state, or null once every slot is empty, so "no error" stays a plain null. */
function pack(state: ChatErrorState): ChatErrorState | null {
  return state.rejection || state.ingest || state.connection ? state : null;
}

/** A new error replaces the last one of the same cause and restarts its clear window. */
export function noteChatError(
  state: ChatErrorState | null,
  message: string,
  now: number,
): ChatErrorState {
  return { ...(state ?? EMPTY), [slotFor(message)]: { message, at: now, replyAt: null } };
}

/**
 * A reply went out: a refused-reply or connection error clears once the grace window passes
 * without a new one. An ingest error waits for `noteIngestHealthy`: a reply can still go out
 * while the ingest queue is backed up.
 */
export function noteChatReply(state: ChatErrorState | null, now: number): ChatErrorState | null {
  if (!state) return state;
  const stamp = (entry: ChatErrorEntry | null) =>
    entry && entry.replyAt === null ? { ...entry, replyAt: now } : entry;
  const rejection = stamp(state.rejection);
  const connection = stamp(state.connection);
  if (rejection === state.rejection && connection === state.connection) return state;
  return { ...state, rejection, connection };
}

/**
 * The IRC socket (re)connected: Twitch RECONNECT, the liveness watchdog, a token refresh. A
 * fresh connection supersedes connection errors only; a refused reply and a failing DireWork
 * API both survive the new socket, so the header can't go green over a bot that still can't
 * post or is still dropping commands.
 */
export function noteChatConnected(state: ChatErrorState | null): ChatErrorState | null {
  if (!state?.connection) return state;
  return pack({ ...state, connection: null });
}

/** The ingest queue drained after a command reached DireWork: an ingest error is over. */
export function noteIngestHealthy(state: ChatErrorState | null): ChatErrorState | null {
  if (!state?.ingest) return state;
  return pack({ ...state, ingest: null });
}

function showing(entry: ChatErrorEntry | null, now: number): entry is ChatErrorEntry {
  return !!entry && (entry.replyAt === null || now - entry.replyAt < REPLY_CLEAR_GRACE_MS);
}

/**
 * The message to show at `now`: the newest durable error still holding, else a connection
 * error still holding, else null. A connection error never hides a durable one: the activity
 * log has it, and the header's IRC status already says it is reconnecting.
 */
export function currentChatError(state: ChatErrorState | null, now: number): string | null {
  if (!state) return null;
  const durable = [state.rejection, state.ingest].filter((entry) => showing(entry, now));
  durable.sort((a, b) => b.at - a.at);
  const shown = durable[0] ?? (showing(state.connection, now) ? state.connection : null);
  return shown?.message ?? null;
}
