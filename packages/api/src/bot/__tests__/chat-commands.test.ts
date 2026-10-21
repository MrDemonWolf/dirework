import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";

import { chatCommandOf, isDireworkCommandLine } from "../../chat-commands";
import type { BotConfigData } from "../../config-shared";
import { aliasKeys } from "../../routers/bot";
import { handleMessage } from "../commands";

const ALIASES = { t: "task", "!D": "!done", TIMER: "task", "!!ok": "check" };

/** True when the REAL server parser resolves the line to a Dirework command. */
async function serverRunsCommand(message: string): Promise<boolean> {
  // With every command enabled, handleMessage claims the line exactly when it
  // resolves to a Dirework command; a refused claim stops before any DB work.
  const claim = vi.fn(async () => false);
  await handleMessage({
    db: {} as DbClient,
    channelName: "streamer",
    config: {
      taskCommandsEnabled: true,
      timerCommandsEnabled: true,
      commandAliases: ALIASES,
      muted: false,
      blockedViewers: [],
    } as unknown as BotConfigData,
    message,
    userInfo: {
      twitchId: "42",
      username: "viewer",
      displayName: "Viewer",
      color: null,
      isBroadcaster: false,
      isMod: false,
    },
    say: () => {},
    claim,
  });
  return claim.mock.calls.length > 0;
}

const LINES = [
  "!task write docs",
  "!TASK caps",
  "  !done  ",
  "!timer start",
  "!today",
  "!dwhelp",
  "!DwCommands",
  "!dw",
  "!DW  help  !task",
  "!dw help t",
  "!dwx",
  "!dw\u{E0000}",
  "!t aliased",
  "!T aliased caps",
  "!d",
  "!ok",
  "!!ok",
  "!!task doubled",
  "!lurk",
  "!so @friend",
  "!tasks",
  "!",
  "task without bang",
  "hello !task",
  "!task\u{E0000}",
  "\u{E0000}!done",
  "!done\u{E0000} 2",
  "!mute",
  "!block @someone",
  "!UNBLOCK x",
];

describe("isDireworkCommandLine", () => {
  const keys = new Set(aliasKeys(ALIASES));

  it.each(LINES)("agrees with the server parser on %j", async (line) => {
    expect(isDireworkCommandLine(line, keys)).toBe(await serverRunsCommand(line));
  });

  it("filters other bots' commands without any alias config", () => {
    expect(isDireworkCommandLine("!lurk", new Set())).toBe(false);
    expect(isDireworkCommandLine("!task a", new Set())).toBe(true);
    expect(isDireworkCommandLine("!today", new Set())).toBe(true);
    expect(isDireworkCommandLine("!dw help task", new Set())).toBe(true);
    expect(isDireworkCommandLine("!DW", new Set())).toBe(true);
    expect(isDireworkCommandLine("!t a", new Set())).toBe(false);
  });
});

describe("chatCommandOf", () => {
  it("returns the lowercased first word with its bang, or null", () => {
    expect(chatCommandOf("  !Task  a b")).toBe("!task");
    expect(chatCommandOf("hi !task")).toBeNull();
  });
});

describe("aliasKeys", () => {
  it("returns canonical keys and drops built-in names and empties", () => {
    expect(aliasKeys({ "!T": "task", t: "task", timer: "task", "!": "done", go: "next" })).toEqual([
      "t",
      "go",
    ]);
    expect(aliasKeys(null)).toEqual([]);
  });
});
