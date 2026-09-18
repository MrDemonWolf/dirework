import { describe, expect, it } from "vitest";

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
