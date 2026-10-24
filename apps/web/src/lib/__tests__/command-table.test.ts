import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommandTable } from "@/components/bot-settings/command-table";
import { aliasesByTarget, aliasesToRows, rowsToAliases } from "@/lib/alias-rows";
import { metaCommands, taskCommands, timerCommands } from "@/lib/command-rows";

/**
 * The Commands page's tables, rendered for real: who may run each command, and the aliases
 * the alias editor's draft would save, written as the viewer types them.
 */

function render(rows: typeof taskCommands, aliases: Record<string, string>, disabled = false) {
  const { aliases: canonical } = rowsToAliases(aliasesToRows(aliases));
  return renderToStaticMarkup(
    createElement(CommandTable, {
      caption: "Commands",
      commands: rows,
      aliases: aliasesByTarget(canonical),
      disabled,
    }),
  );
}

/** Each body row: the command, the who chip, and the aliases shown. */
function bodyRows(html: string) {
  const body = html.slice(html.indexOf("<tbody"));
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => ({
    command: /<code[^>]*>([^<]*)<\/code>/.exec(row!)?.[1],
    who: /(Everyone|Mods)/.exec(row!)?.[1],
    aliases: [...row!.matchAll(/<li><code[^>]*>([^<]*)<\/code><\/li>/g)].map((m) => m[1]),
  }));
}

describe("CommandTable", () => {
  it("lists every row with who may run it", () => {
    const rows = bodyRows(render(taskCommands, {}));
    expect(rows.map((row) => row.command)).toEqual(taskCommands.map((row) => row.command));
    expect(rows.find((row) => row.command === "!clear")?.who).toBe("Mods");
    expect(rows.find((row) => row.command === "!task")?.who).toBe("Everyone");
  });

  it("shows each alias beside the command it runs, in the form viewers type", () => {
    const rows = bodyRows(render(timerCommands, { "!pomo": "!timer", t: "task" }));
    for (const row of rows)
      expect(row.aliases).toEqual([`${row.command!.replace("!timer", "!pomo")}`]);
    const task = bodyRows(render(taskCommands, { "!T": "task", add: "task" }));
    expect(task.find((row) => row.command === "!task")?.aliases).toEqual(["!add", "!t"]);
    expect(task.find((row) => row.command === "!done")?.aliases).toEqual([]);
  });

  it("drops an alias the server would reject", () => {
    // "help" is a built-in name, so it can't be an alias; the rest still shows.
    const rows = bodyRows(render(taskCommands, { help: "task", t: "task" }));
    expect(rows.find((row) => row.command === "!task")?.aliases ?? []).not.toContain("!help");
  });

  it("dims a switched-off group but never the always-on table it is shown beside", () => {
    expect(render(taskCommands, {}, true)).toMatch(/<table class="[^"]*opacity-60/);
    expect(render(metaCommands, {})).not.toMatch(/<table class="[^"]*opacity-60/);
  });
});
