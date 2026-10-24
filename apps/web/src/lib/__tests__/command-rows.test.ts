import { describe, expect, it } from "vitest";

import {
  isDireworkCommandLine,
  KNOWN_ALIAS_TARGETS,
  META_COMMANDS,
  MODERATION_COMMANDS,
} from "@dirework/api/chat-commands";

import { metaCommands, moderationCommands, taskCommands, timerCommands } from "@/lib/command-rows";

const commandName = (row: { command: string }) => row.command.split(" ")[0]!.slice(1);
const allRows = [...taskCommands, ...timerCommands, ...moderationCommands];
const isMeta = (row: { command: string }) =>
  (META_COMMANDS as readonly string[]).includes(commandName(row));

// The Bot settings command legend rows are hand-written; this pins them to the
// command names the chat resolver actually accepts, so a new or renamed
// command can't silently go missing from (or linger in) the dashboard.
describe("bot settings command tables", () => {
  it("list exactly the built-in alias targets", () => {
    const shown = new Set(
      [...taskCommands, ...timerCommands].filter((row) => !isMeta(row)).map(commandName),
    );
    expect([...shown].sort()).toEqual([...KNOWN_ALIAS_TARGETS].sort());
  });

  it("list every always-on meta command in the Task tab, open to everyone", () => {
    expect(new Set(metaCommands.map(commandName))).toEqual(new Set(META_COMMANDS));
    for (const row of metaCommands) {
      expect(taskCommands).toContain(row);
      expect(row.permission).toBe("everyone");
      // The usage is a line the bot page relays, so the row teaches a command that works.
      expect(isDireworkCommandLine(row.usage, new Set()), row.usage).toBe(true);
    }
    expect(metaCommands.map((row) => row.usage)).toEqual(
      expect.arrayContaining(["!dw help", "!dw help [command]", "!dw commands"]),
    );
  });

  // `alwaysOn` keeps a row out of the legend its tab's switch dims (the Commands page draws them in their own always-on table),
  // so only the meta commands may carry it: a task or timer row marked always on would stay
  // lit while the bot ignores it.
  it("mark exactly the meta commands as always on", () => {
    expect(allRows.filter((row) => row.alwaysOn)).toEqual(metaCommands);
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
