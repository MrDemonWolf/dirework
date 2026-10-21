import { describe, expect, it } from "vitest";

import { LEGACY_TASK_MESSAGES } from "@dirework/db/defaults";

import { KNOWN_ALIAS_TARGETS, META_COMMANDS, MODERATION_COMMANDS } from "../../chat-commands";
import {
  buildBotConfig,
  DEFAULT_TASK_MESSAGES,
  MAX_CHAT_BYTES,
  MAX_MESSAGE_TEMPLATE_BYTES,
  TASK_MESSAGE_FIELDS,
  utf8ByteLength,
} from "../../config-shared";
import { interpolate, resolveAlias } from "../commands";
import {
  COMMAND_HELP_LINES,
  DW_GUIDE_REPLY,
  DW_TASKS_OFF_REPLY,
  DW_TIMER_OFF_REPLY,
  DW_UNKNOWN_REPLY,
  parseDwArgs,
  resolveHelpTarget,
  STARTER_STEPS,
} from "../viewer-help";

const ALIASES = { t: "task", "!D": "!done", add: "task", go: "timer" };
const resolve = (command: string) => resolveAlias(command, ALIASES);
const parse = (line: string) => parseDwArgs(line.trim().split(/\s+/).slice(1), resolve);

// Twitch display names are at most 25 characters; a CJK name is 3 bytes each.
const LONGEST_NAME = "名".repeat(25);
/** Aim for one glance: a built-in line (without the name) stays under this. */
const GLANCE_BYTES = 250;

const emojiCount = (text: string) => (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;

describe("parseDwArgs", () => {
  it.each([
    ["!dw", { kind: "guide" }],
    ["!dw help", { kind: "guide" }],
    ["!DW  HELP", { kind: "guide" }],
    ["!dw commands", { kind: "commands" }],
    ["!dw help task", { kind: "command", name: "task" }],
    ["!DW  HELP  !task", { kind: "command", name: "task" }],
    ["!dw help TIMER", { kind: "command", name: "timer" }],
    ["!dw help !block", { kind: "command", name: "block" }],
    ["!dw help dw", { kind: "command", name: "dw" }],
    ["!dw done", { kind: "command", name: "done" }],
    // The streamer's aliases resolve to the command they point at.
    ["!dw help t", { kind: "command", name: "task" }],
    ["!dw help !D", { kind: "command", name: "done" }],
    ["!dw help go", { kind: "command", name: "timer" }],
    ["!dw help lurk", { kind: "command", name: null }],
    ["!dw help constructor", { kind: "command", name: null }],
    ["!dw help !", { kind: "command", name: null }],
    ["!dw banana", { kind: "command", name: null }],
  ])("%j → %j", (line, expected) => {
    expect(parse(line)).toEqual(expected);
  });

  it("resolves a built-in name even when a stale alias claims it", () => {
    expect(resolveHelpTarget("task", (c) => resolveAlias(c, { task: "clear" }))).toBe("task");
  });
});

describe("help lines", () => {
  const everyCommand = [...KNOWN_ALIAS_TARGETS, ...MODERATION_COMMANDS, ...META_COMMANDS];

  it("cover every built-in command, and nothing else", () => {
    expect(Object.keys(COMMAND_HELP_LINES).sort()).toEqual([...everyCommand].sort());
  });

  it("start with the command they explain and give an example of it", () => {
    for (const [name, line] of Object.entries(COMMAND_HELP_LINES)) {
      const body = line.replace(/^\(mods only\) /, "");
      expect(body.startsWith(`!${name} `), name).toBe(true);
      // The command appears again later in the line: an example, not just the name.
      expect(body.indexOf(`!${name}`, 1), name).toBeGreaterThan(0);
    }
  });

  it("mark exactly the mod-only commands", () => {
    const modOnly = Object.entries(COMMAND_HELP_LINES)
      .filter(([, line]) => line.startsWith("(mods only) "))
      .map(([name]) => name);
    expect(new Set(modOnly)).toEqual(new Set(["clear", "timer", ...MODERATION_COMMANDS]));
  });

  it("fit Twitch's limit and read in one glance, with at most one emoji", () => {
    const replies = [
      DW_GUIDE_REPLY(LONGEST_NAME),
      DW_TASKS_OFF_REPLY(LONGEST_NAME),
      DW_TIMER_OFF_REPLY(LONGEST_NAME),
      DW_UNKNOWN_REPLY(LONGEST_NAME),
      ...Object.values(COMMAND_HELP_LINES).map((line) => `${LONGEST_NAME}, ${line}`),
    ];
    for (const reply of replies) {
      expect(utf8ByteLength(reply), reply).toBeLessThanOrEqual(MAX_CHAT_BYTES);
      expect(utf8ByteLength(reply.replace(`${LONGEST_NAME}, `, "")), reply).toBeLessThan(
        GLANCE_BYTES,
      );
      expect(emojiCount(reply), reply).toBeLessThanOrEqual(1);
    }
  });

  it("never open a reply with a chat command", () => {
    for (const reply of [DW_GUIDE_REPLY("Viewer"), DW_UNKNOWN_REPLY("Viewer")]) {
      expect(reply).not.toMatch(/^[!./]/);
    }
  });
});

describe("the default !help reply", () => {
  it("teaches the same three steps as !dw help, and points at !dw help", () => {
    expect(DEFAULT_TASK_MESSAGES.help).toContain(STARTER_STEPS);
    expect(DW_GUIDE_REPLY("Viewer")).toContain(STARTER_STEPS);
    expect(DEFAULT_TASK_MESSAGES.help).toMatch(/!dw help$/);
  });

  it("fits the template cap and, filled in, one glance", () => {
    expect(utf8ByteLength(DEFAULT_TASK_MESSAGES.help)).toBeLessThanOrEqual(
      MAX_MESSAGE_TEMPLATE_BYTES,
    );
    const filled = interpolate(DEFAULT_TASK_MESSAGES.help, { user: LONGEST_NAME });
    expect(utf8ByteLength(filled)).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    expect(utf8ByteLength(interpolate(DEFAULT_TASK_MESSAGES.help, { user: "" }))).toBeLessThan(
      GLANCE_BYTES,
    );
  });

  it("replaces the previous command-list default on instances that never edited it", () => {
    const previous =
      "{user}, commands: !task, !done, !edit, !remove, !focus, !check, !today, !next. Full list: !dwhelp";
    expect(LEGACY_TASK_MESSAGES.help).toContain(previous);

    const row = {
      id: "singleton",
      taskCommandsEnabled: true,
      timerCommandsEnabled: true,
      commandAliases: {},
      ...Object.fromEntries(Object.values(TASK_MESSAGE_FIELDS).map((column) => [column, "x"])),
    } as unknown as Parameters<typeof buildBotConfig>[0];
    expect(buildBotConfig({ ...row, msgHelp: previous }).task.help).toBe(
      DEFAULT_TASK_MESSAGES.help,
    );
    expect(buildBotConfig({ ...row, msgHelp: "Ask me anything, {user}" }).task.help).toBe(
      "Ask me anything, {user}",
    );
  });
});
