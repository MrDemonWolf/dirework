// The bot page's "latest chat error" banner state. Pure (time passed in) apart from
// `watchChatErrorExpiry`, the one timer the page arms: it fires once at the next reply-cleared
// window's end and prunes the state, so the page renders from the state alone and never
// ticks to re-check a clear window. No change to the session state machine.

import { isIngestError, isLoginRefreshError } from "./bot-session";
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
 * - `login`: the hourly revalidation couldn't refresh the bot's Twitch login. The live socket
 *   may keep working until the token expires, so neither a reply nor a reconnect clears it;
 *   only a later getSession that succeeds (`noteSessionRefreshed`).
 * - `connection`: anything else (the socket, the watchdog, a login refresh). A fresh connect
 *   or a reply that goes through clears it, and it never hides a durable error.
 */
export interface ChatErrorState {
  rejection: ChatErrorEntry | null;
  ingest: ChatErrorEntry | null;
  login: ChatErrorEntry | null;
  connection: ChatErrorEntry | null;
}

type Slot = keyof ChatErrorState;

const EMPTY: ChatErrorState = { rejection: null, ingest: null, login: null, connection: null };

function slotFor(message: string): Slot {
  if (isChatRejection(message)) return "rejection";
  if (isIngestError(message)) return "ingest";
  if (isLoginRefreshError(message)) return "login";
  return "connection";
}

/** The state, or null once every slot is empty, so "no error" stays a plain null. */
function pack(state: ChatErrorState): ChatErrorState | null {
  return state.rejection || state.ingest || state.login || state.connection ? state : null;
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

/** A getSession succeeded: the bot's Twitch login refreshes again. */
export function noteSessionRefreshed(state: ChatErrorState | null): ChatErrorState | null {
  if (!state?.login) return state;
  return pack({ ...state, login: null });
}

/** The ingest queue drained after a command reached DireWork: an ingest error is over. */
export function noteIngestHealthy(state: ChatErrorState | null): ChatErrorState | null {
  if (!state?.ingest) return state;
  return pack({ ...state, ingest: null });
}

function expired(entry: ChatErrorEntry | null, now: number): boolean {
  return !!entry && entry.replyAt !== null && now - entry.replyAt >= REPLY_CLEAR_GRACE_MS;
}

/**
 * When the next entry's reply-cleared window ends (`replyAt + REPLY_CLEAR_GRACE_MS`, the
 * earliest one), or null when no entry can expire: none has been followed by a reply yet, or
 * it is an ingest or login error, which only a later event clears.
 */
export function chatErrorDeadline(state: ChatErrorState | null): number | null {
  if (!state) return null;
  let deadline: number | null = null;
  for (const entry of [state.rejection, state.ingest, state.login, state.connection]) {
    if (entry?.replyAt == null) continue;
    const end = entry.replyAt + REPLY_CLEAR_GRACE_MS;
    if (deadline === null || end < deadline) deadline = end;
  }
  return deadline;
}

/** Drop every entry whose reply-cleared window has ended at `now`; null once none is left. */
export function pruneChatErrors(state: ChatErrorState | null, now: number): ChatErrorState | null {
  if (!state) return state;
  const slots = ["rejection", "ingest", "login", "connection"] as const;
  if (!slots.some((slot) => expired(state[slot], now))) return state;
  const next = { ...state };
  for (const slot of slots) if (expired(next[slot], now)) next[slot] = null;
  return pack(next);
}

/**
 * The message to show for a pruned state: the newest durable error, else a connection error,
 * else null. A connection error never hides a durable one: the activity log has it, and the
 * header's IRC status already says it is reconnecting.
 */
export function shownChatError(state: ChatErrorState | null): string | null {
  if (!state) return null;
  const durable = [state.rejection, state.ingest, state.login].filter(
    (entry): entry is ChatErrorEntry => entry !== null,
  );
  durable.sort((a, b) => b.at - a.at);
  return (durable[0] ?? state.connection)?.message ?? null;
}

/** The message to show at `now`, as if the state had been pruned then. */
export function currentChatError(state: ChatErrorState | null, now: number): string | null {
  return shownChatError(pruneChatErrors(state, now));
}

/**
 * Arms one timeout for `state`'s deadline (nothing when it has none) that hands `apply` a
 * pruning update; returns the cancel. The page calls it once per state (an effect keyed on
 * it), so a pruned state re-arms for the next deadline and a cleared one arms nothing. The
 * update prunes at the deadline at the latest, so a timer that fires a millisecond early still
 * clears the entry it was armed for.
 */
export function watchChatErrorExpiry(
  state: ChatErrorState | null,
  apply: (update: (prev: ChatErrorState | null) => ChatErrorState | null) => void,
): () => void {
  const deadline = chatErrorDeadline(state);
  if (deadline === null) return () => {};
  const timer = setTimeout(
    () => apply((prev) => pruneChatErrors(prev, Math.max(Date.now(), deadline))),
    Math.max(0, deadline - Date.now()),
  );
  return () => clearTimeout(timer);
}
