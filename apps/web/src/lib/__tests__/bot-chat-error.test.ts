import { describe, expect, it } from "vitest";

import {
  type ChatErrorState,
  currentChatError,
  noteChatConnected,
  noteChatError,
  noteChatReply,
  noteIngestHealthy,
  REPLY_CLEAR_GRACE_MS,
} from "../bot-chat-error";
import { INGEST_BACKLOG_MESSAGE, INGEST_DROPPED_MESSAGE } from "../bot-session";

const BANNED = "Twitch didn't post the bot's reply: the bot account is banned from this channel";
const WENT_SILENT = "Twitch IRC went silent — reconnecting";

describe("bot page chat error", () => {
  it("shows nothing before any error", () => {
    expect(currentChatError(null, 1_000)).toBeNull();
    expect(noteChatReply(null, 1_000)).toBeNull();
  });

  it("shows an error until a later reply goes out cleanly", () => {
    let state: ChatErrorState | null = noteChatError(null, BANNED, 1_000);
    expect(currentChatError(state, 60_000)).toBe(BANNED);

    state = noteChatReply(state, 70_000);
    // Twitch answers a refused reply with a NOTICE, so the error holds through the window.
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS - 1)).toBe(BANNED);
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS)).toBeNull();
  });

  it("keeps the error when the reply is refused again", () => {
    let state: ChatErrorState | null = noteChatReply(noteChatError(null, BANNED, 1_000), 2_000);
    state = noteChatError(state, BANNED, 2_500);
    expect(currentChatError(state, 2_000 + REPLY_CLEAR_GRACE_MS + 1)).toBe(BANNED);
  });

  it("times the window from the first reply after the error", () => {
    let state: ChatErrorState | null = noteChatReply(noteChatError(null, BANNED, 1_000), 2_000);
    state = noteChatReply(state, 9_000);
    expect(currentChatError(state, 2_000 + REPLY_CLEAR_GRACE_MS)).toBeNull();
  });

  it("keeps a chat rejection across an IRC reconnect until a later reply clears it", () => {
    // Twitch RECONNECT, the liveness watchdog or a token refresh opens a new socket, but the
    // ban is still there: the header must not go back to a green Connected.
    let state = noteChatConnected(noteChatError(null, BANNED, 1_000));
    expect(currentChatError(state, 60_000)).toBe(BANNED);

    // Mid-window, a reconnect keeps the reply that started the window.
    state = noteChatConnected(noteChatReply(state, 70_000));
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS - 1)).toBe(BANNED);
    expect(currentChatError(state, 70_000 + REPLY_CLEAR_GRACE_MS)).toBeNull();

    // Once cleared, a later reconnect doesn't bring the old error back.
    expect(currentChatError(noteChatConnected(state), 200_000)).toBeNull();
  });

  it("keeps a DireWork ingest error across an IRC reconnect until ingest recovers", () => {
    for (const message of [INGEST_DROPPED_MESSAGE, INGEST_BACKLOG_MESSAGE]) {
      // Reconnecting to Twitch says nothing about the API: commands may still be dropped.
      const state = noteChatConnected(noteChatError(null, message, 1_000));
      expect(currentChatError(state, 60_000)).toBe(message);
      expect(noteIngestHealthy(state)).toBeNull();
    }
  });

  it("leaves IRC errors to their own clear rules when ingest recovers", () => {
    const banned = noteChatError(null, BANNED, 1_000);
    expect(noteIngestHealthy(banned)).toBe(banned);
    const silent = noteChatError(null, WENT_SILENT, 1_000);
    expect(noteIngestHealthy(silent)).toBe(silent);
    expect(noteIngestHealthy(null)).toBeNull();
  });

  it("clears a connection error on a fresh IRC connect", () => {
    expect(noteChatConnected(noteChatError(null, WENT_SILENT, 1_000))).toBeNull();
    expect(noteChatConnected(null)).toBeNull();
  });

  it("shows the newest error", () => {
    const slowMode = "Twitch didn't post the bot's reply: slow mode is on";
    let state = noteChatError(noteChatError(null, BANNED, 1_000), slowMode, 2_000);
    expect(currentChatError(state, 5_000)).toBe(slowMode);
    state = noteChatError(noteChatError(null, WENT_SILENT, 1_000), "WebSocket error", 2_000);
    expect(currentChatError(state, 5_000)).toBe("WebSocket error");
  });

  it("keeps a durable error when a connection error arrives, so the reconnect can't clear it", () => {
    for (const durable of [BANNED, INGEST_DROPPED_MESSAGE]) {
      // The watchdog reports "went silent" before reconnecting.
      let state: ChatErrorState | null = noteChatError(
        noteChatError(null, durable, 1_000),
        WENT_SILENT,
        30_000,
      );
      expect(currentChatError(state, 30_000)).toBe(durable);
      state = noteChatConnected(state);
      expect(currentChatError(state, 60_000)).toBe(durable);
    }
  });

  it("shows a connection error once the earlier durable error has cleared", () => {
    const cleared = noteChatReply(noteChatError(null, BANNED, 1_000), 2_000);
    const state = noteChatError(cleared, WENT_SILENT, 2_000 + REPLY_CLEAR_GRACE_MS);
    expect(currentChatError(state, 2_000 + REPLY_CLEAR_GRACE_MS)).toBe(WENT_SILENT);
  });
});
