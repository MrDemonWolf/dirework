import { describe, expect, it } from "vitest";

import { KNOWN_ALIAS_TARGETS } from "@dirework/api/chat-commands";

import { aliasesByTarget, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { aliasedCommand, commandName, taskCommands, timerCommands } from "@/lib/command-rows";

describe("the Commands table's alias column", () => {
  it("names every switchable row by an alias target", () => {
    for (const row of [...taskCommands, ...timerCommands].filter((r) => !r.alwaysOn)) {
      expect(KNOWN_ALIAS_TARGETS as readonly string[]).toContain(commandName(row));
    }
  });

  it("swaps only the first word for the alias", () => {
    const start = timerCommands.find((row) => row.command === "!timer start")!;
    expect(commandName(start)).toBe("timer");
    expect(aliasedCommand(start, "pomo")).toBe("!pomo start");
    expect(aliasedCommand(taskCommands[0]!, "t")).toBe("!t");
  });

  it("groups the draft's canonical aliases by target, sorted", () => {
    const { aliases } = rowsToAliases(aliasesToRows({ "!T": "!task", add: "task", pomo: "timer" }));
    const byTarget = aliasesByTarget(aliases);
    expect(byTarget.get("task")).toEqual(["add", "t"]);
    expect(byTarget.get("timer")).toEqual(["pomo"]);
    expect(byTarget.get("done")).toBeUndefined();
  });
});
