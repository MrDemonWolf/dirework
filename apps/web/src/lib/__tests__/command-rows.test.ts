import { describe, expect, it } from "vitest";

import { KNOWN_ALIAS_TARGETS } from "@dirework/api/chat-commands";

import { taskCommands, timerCommands } from "@/components/bot-settings/command-tab-panel";

// The Bot settings reference tables are hand-written; this pins them to the
// command names the chat resolver actually accepts, so a new or renamed
// command can't silently go missing from (or linger in) the dashboard.
describe("bot settings command tables", () => {
  it("list exactly the built-in alias targets", () => {
    const shown = new Set(
      [...taskCommands, ...timerCommands].map((row) => row.command.split(" ")[0]!.slice(1)),
    );
    expect([...shown].sort()).toEqual([...KNOWN_ALIAS_TARGETS].sort());
  });

  it("show each row's command at the start of its usage", () => {
    for (const row of [...taskCommands, ...timerCommands]) {
      expect(row.usage.startsWith(row.command)).toBe(true);
    }
  });
});
