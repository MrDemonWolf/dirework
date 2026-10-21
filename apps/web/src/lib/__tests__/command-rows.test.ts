import { describe, expect, it } from "vitest";

import { KNOWN_ALIAS_TARGETS, MODERATION_COMMANDS } from "@dirework/api/chat-commands";

import { moderationCommands, taskCommands, timerCommands } from "@/lib/command-rows";

const commandName = (row: { command: string }) => row.command.split(" ")[0]!.slice(1);
const allRows = [...taskCommands, ...timerCommands, ...moderationCommands];

// The Bot settings command legend rows are hand-written; this pins them to the
// command names the chat resolver actually accepts, so a new or renamed
// command can't silently go missing from (or linger in) the dashboard.
describe("bot settings command tables", () => {
  it("list exactly the built-in alias targets", () => {
    const shown = new Set([...taskCommands, ...timerCommands].map(commandName));
    expect([...shown].sort()).toEqual([...KNOWN_ALIAS_TARGETS].sort());
  });

  it("list exactly the moderation commands in the Moderation card", () => {
    expect(moderationCommands.map(commandName).sort()).toEqual([...MODERATION_COMMANDS].sort());
  });

  it("show each row's command at the start of its usage", () => {
    for (const row of allRows) {
      expect(row.usage.startsWith(row.command)).toBe(true);
    }
  });

  it("give every row a permission, with !clear, !timer and moderation mod-only", () => {
    for (const row of allRows) {
      expect(["everyone", "mods"]).toContain(row.permission);
    }
    const modOnly = allRows.filter((row) => row.permission === "mods").map(commandName);
    expect(new Set(modOnly)).toEqual(new Set(["clear", "timer", ...MODERATION_COMMANDS]));
  });

  it("documents !today in the task tab", () => {
    expect(taskCommands.find((row) => row.command === "!today")).toMatchObject({
      usage: "!today",
      description: "Show your focus and next tasks",
    });
  });
});
