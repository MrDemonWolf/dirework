import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hasSafeIrcCredentials, sanitizeIrcMessage } from "../irc-sanitize";

describe("sanitizeIrcMessage", () => {
  it("leaves ordinary replies unchanged", () => {
    expect(sanitizeIrcMessage("Task added, Viewer!")).toBe("Task added, Viewer!");
  });

  it("neutralizes CRLF command injection at the IRC frame boundary", () => {
    expect(sanitizeIrcMessage("hello\r\nJOIN #attacker")).toBe("hello JOIN #attacker");
  });

  it("removes NUL, DEL, tabs, and repeated whitespace", () => {
    expect(sanitizeIrcMessage("  hi\0\tthere\u007f  friend  ")).toBe("hi there friend");
  });

  it("drops an all-control reply", () => {
    expect(sanitizeIrcMessage("\r\n\0")).toBe("");
  });
});

describe("hasSafeIrcCredentials", () => {
  const valid = {
    botUsername: "dirework_bot",
    channelName: "mrdemonwolf",
    chatToken: "oauth-token-value",
  };

  it("accepts bounded Twitch logins and a control-free token", () => {
    expect(hasSafeIrcCredentials(valid)).toBe(true);
  });

  it.each([
    { ...valid, botUsername: "bad nick" },
    { ...valid, channelName: "channel\r\nJOIN attacker" },
    { ...valid, chatToken: "token\r\nJOIN #attacker" },
    { ...valid, chatToken: "" },
    { ...valid, chatToken: "x".repeat(4097) },
  ])("rejects a credential that could escape or abuse an IRC frame %#", (credentials) => {
    expect(hasSafeIrcCredentials(credentials)).toBe(false);
  });

  it("accepts a mixed-case login, as Twitch sends display-cased names", () => {
    expect(hasSafeIrcCredentials({ ...valid, botUsername: "Bot_User" })).toBe(true);
  });

  it("rejects a login with U+212A KELVIN SIGN, which lowercases to an ASCII k", () => {
    // The pattern is tested case-insensitively, never after lowercasing: "\u212A".toLowerCase()
    // is "k", so lowercase-then-test would let a non-ASCII byte into the NICK frame.
    expect(hasSafeIrcCredentials({ ...valid, botUsername: "\u212Aelvin" })).toBe(false);
    expect(hasSafeIrcCredentials({ ...valid, channelName: "\u212Aelvin" })).toBe(false);
  });

  it("reuses the shared Twitch login rule instead of a second copy", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../irc-sanitize.ts"), "utf8");
    expect(source).toContain("TWITCH_LOGIN_PATTERN.source");
    expect(source).not.toMatch(/\/\^\[a-z0-9_\]/);
  });
});
