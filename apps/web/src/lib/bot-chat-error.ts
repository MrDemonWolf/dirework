// The bot page's "latest chat error" banner state. Pure (time passed in), so the page can
// derive it from the bot session's existing events and the 1s uptime tick: no extra timers,
// no change to the session state machine.

import { isIngestError } from "./bot-session";
import { isChatRejection } from "./irc-client";

/**
 * How long a sent reply must go unanswered by a new error before the banner clears. Twitch
 * never acknowledges a delivered PRIVMSG; it only answers a rejected one with a NOTICE
 * (banned, slow mode, followers-only), which lands within a second or two of the send.
 * The window starts when the IRC client actually writes the reply (`onSent`), not when it is
 * queued, so a reply held by the rate limiter or a reconnect can't clear the banner early.
 */
export const REPLY_CLEAR_GRACE_MS = 10_000;

export interface ChatErrorState {
  message: string;
  /** When the error was reported. */
  at: number;
  /** When the first reply after the error was sent, or null while none has been. */
  replyAt: number | null;
}

/** A new error replaces the last one and restarts the clear window. */
export function noteChatError(message: string, now: number): ChatErrorState {
  return { message, at: now, replyAt: null };
}

/** A reply went out: the error clears once the grace window passes without a new one. */
export function noteChatReply(state: ChatErrorState | null, now: number): ChatErrorState | null {
  if (!state || state.replyAt !== null) return state;
  return { ...state, replyAt: now };
}

/**
 * The IRC socket (re)connected: Twitch RECONNECT, the liveness watchdog, a token refresh. A
 * fresh connection supersedes connection errors, but a ban, timeout or chat mode belongs to
 * the channel, and a failing DireWork API has nothing to do with IRC: both survive the new
 * socket. Clearing them here would put a green "Connected" over a bot that still can't post
 * or is still dropping commands.
 */
export function noteChatConnected(state: ChatErrorState | null): ChatErrorState | null {
  return state && (isChatRejection(state.message) || isIngestError(state.message)) ? state : null;
}

/** The ingest queue drained after a command reached DireWork: an ingest error is over. */
export function noteIngestHealthy(state: ChatErrorState | null): ChatErrorState | null {
  return state && isIngestError(state.message) ? null : state;
}

/** The message to show at `now`, or null once a later reply has gone through cleanly. */
export function currentChatError(state: ChatErrorState | null, now: number): string | null {
  if (!state) return null;
  if (state.replyAt !== null && now - state.replyAt >= REPLY_CLEAR_GRACE_MS) return null;
  return state.message;
}
