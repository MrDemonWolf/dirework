import { describe, expect, it } from "vitest";

import {
  type ChatErrorState,
  currentChatError,
  noteChatConnected,
  noteChatError,
  noteChatReply,
  REPLY_CLEAR_GRACE_MS,
} from "../bot-chat-error";

const BANNED = "Twitch didn't post the bot's reply: the bot account is banned from this channel";
const WENT_SILENT = "Twitch IRC went silent — reconnecting";

describe("bot page chat error", () => {
  it("shows nothing before any error", () => {
    expect(currentChatError(null, 1_000)).toBeNull();
    expect(noteChatReply(null, 1_000)).toBeNull();
  });

  it("shows an error until a later reply goes out cleanly", () => {
    let state: ChatErrorState | null = noteChatError(BANNED, 1_000);
    expect(currentChatError(state, 60_000)).toBe(BANNED);

    state = noteChatReply(state, 70_000);
    // Twitch answers a refused reply with a NOTICE, so the error holds through the window.
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS - 1)).toBe(BANNED);
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS)).toBeNull();
  });

  it("keeps the error when the reply is refused again", () => {
    let state: ChatErrorState | null = noteChatReply(noteChatError(BANNED, 1_000), 2_000);
    state = noteChatError(BANNED, 2_500);
    expect(currentChatError(state, 2_000 + REPLY_CLEAR_GRACE_MS + 1)).toBe(BANNED);
  });

  it("times the window from the first reply after the error", () => {
    let state: ChatErrorState | null = noteChatReply(noteChatError(BANNED, 1_000), 2_000);
    state = noteChatReply(state, 9_000);
    expect(currentChatError(state, 2_000 + REPLY_CLEAR_GRACE_MS)).toBeNull();
  });

  it("keeps a chat rejection across an IRC reconnect until a later reply clears it", () => {
    // Twitch RECONNECT, the liveness watchdog or a token refresh opens a new socket, but the
    // ban is still there: the header must not go back to a green Connected.
    let state = noteChatConnected(noteChatError(BANNED, 1_000));
    expect(currentChatError(state, 60_000)).toBe(BANNED);

    // Mid-window, a reconnect keeps the reply that started the window.
    state = noteChatConnected(noteChatReply(state, 70_000));
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS - 1)).toBe(BANNED);
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS)).toBeNull();

    // Once cleared, a later reconnect doesn't bring the old error back.
    expect(currentChatError(noteChatConnected(state), 200_000)).toBeNull();
  });

  it("clears a connection error on a fresh IRC connect", () => {
    expect(noteChatConnected(noteChatError(WENT_SILENT, 1_000))).toBeNull();
    expect(noteChatConnected(null)).toBeNull();
  });

  it("shows the newest error", () => {
    const state = noteChatError("slow mode", noteChatError(BANNED, 1_000).at + 1);
    expect(currentChatError(state, 5_000)).toBe("slow mode");
  });
});
