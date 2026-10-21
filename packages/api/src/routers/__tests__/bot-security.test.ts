import { describe, expect, it } from "vitest";

import { MAX_RELAYED_MESSAGE_LENGTH, truncateToLength } from "../../config-shared";
import { botIngestInputSchema, deriveChatPrivileges } from "../bot";

const messageInput = {
  token: "t".repeat(32),
  kind: "message" as const,
  username: "viewer_1",
  displayName: "Viewer",
  twitchId: "123456",
  message: "!task ship the review",
  color: "#00ACED",
  isMod: false,
};

describe("public bot ingest validation", () => {
  it("accepts a normal Twitch chat command", () => {
    expect(botIngestInputSchema.safeParse(messageInput).success).toBe(true);
  });

  it.each(["!task ok\r\nJOIN #attacker", "!task bad\0payload", "!task bad\u007fpayload"])(
    "rejects IRC control characters in %j",
    (message) => {
      expect(botIngestInputSchema.safeParse({ ...messageInput, message }).success).toBe(false);
    },
  );

  // The bot page clamps its relay to MAX_RELAYED_MESSAGE_LENGTH (bot-session.ts);
  // the schema must cap `message` at that same constant, or a drift either way
  // rejects lines the page relays or clamps them for nothing.
  it("caps the relayed message at exactly MAX_RELAYED_MESSAGE_LENGTH", () => {
    const atLimit = "x".repeat(MAX_RELAYED_MESSAGE_LENGTH);
    expect(botIngestInputSchema.safeParse({ ...messageInput, message: atLimit }).success).toBe(
      true,
    );
    expect(
      botIngestInputSchema.safeParse({ ...messageInput, message: `${atLimit}x` }).success,
    ).toBe(false);
  });

  it("accepts any line once clamped the way the bot page does", () => {
    // Over the cap even in code points (what zod's .max counts), so it fails raw.
    const line = `!task ${"😀".repeat(700)}`;
    expect(botIngestInputSchema.safeParse({ ...messageInput, message: line }).success).toBe(false);
    const relayed = truncateToLength(line, MAX_RELAYED_MESSAGE_LENGTH);
    expect(botIngestInputSchema.safeParse({ ...messageInput, message: relayed }).success).toBe(
      true,
    );
  });

  it("rejects malformed Twitch identities and colors", () => {
    expect(
      botIngestInputSchema.safeParse({ ...messageInput, username: "viewer name" }).success,
    ).toBe(false);
    expect(
      botIngestInputSchema.safeParse({ ...messageInput, twitchId: "not-a-number" }).success,
    ).toBe(false);
    expect(
      botIngestInputSchema.safeParse({ ...messageInput, color: "red;display:none" }).success,
    ).toBe(false);
  });
});

describe("broadcaster privilege derivation", () => {
  it("derives broadcaster authority from the stored owner Twitch id", () => {
    expect(deriveChatPrivileges("123456", "123456", false)).toEqual({
      isBroadcaster: true,
      isMod: true,
    });
  });

  it("does not let a different chatter become broadcaster", () => {
    expect(deriveChatPrivileges("owner-id", "attacker-id", false)).toEqual({
      isBroadcaster: false,
      isMod: false,
    });
  });

  it("preserves a moderator badge without upgrading it to broadcaster", () => {
    expect(deriveChatPrivileges("owner-id", "mod-id", true)).toEqual({
      isBroadcaster: false,
      isMod: true,
    });
  });
});
