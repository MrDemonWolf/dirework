// The bot page's "latest chat error" banner state. Pure (time passed in), so the page can
// derive it from the bot session's existing events and the 1s uptime tick: no extra timers,
// no change to the session state machine.

/**
 * How long a sent reply must go unanswered by a new error before the banner clears. Twitch
 * never acknowledges a delivered PRIVMSG; it only answers a rejected one with a NOTICE
 * (banned, slow mode, followers-only), which lands within a second or two of the send.
 * The session reports a reply when it is queued, and the rate limiter can hold it a few
 * seconds under a burst, so the window has headroom.
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

/** The message to show at `now`, or null once a later reply has gone through cleanly. */
export function currentChatError(state: ChatErrorState | null, now: number): string | null {
  if (!state) return null;
  if (state.replyAt !== null && now - state.replyAt >= REPLY_CLEAR_GRACE_MS) return null;
  return state.message;
}
