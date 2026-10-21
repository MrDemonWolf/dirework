import { describe, expect, it } from "vitest";

import {
  type ChatErrorState,
  currentChatError,
  noteChatError,
  noteChatReply,
  REPLY_CLEAR_GRACE_MS,
} from "../bot-chat-error";

const BANNED = "Twitch didn't post the bot's reply: the bot account is banned from this channel";

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

  it("shows the newest error", () => {
    const state = noteChatError("slow mode", noteChatError(BANNED, 1_000).at + 1);
    expect(currentChatError(state, 5_000)).toBe("slow mode");
  });
});
