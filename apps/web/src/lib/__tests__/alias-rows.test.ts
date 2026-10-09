import { describe, expect, it } from "vitest";

import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import { aliasesToRows, rowsToAliases, type AliasRow } from "../alias-rows";

const row = (id: string, key: string, value: string): AliasRow => ({ id, key, value });

describe("aliasesToRows", () => {
  it("gives every alias a distinct row id", () => {
    const rows = aliasesToRows({ t: "task", d: "done" });
    expect(rows.map(({ key, value }) => [key, value])).toEqual([
      ["t", "task"],
      ["d", "done"],
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});

describe("rowsToAliases", () => {
  it("normalizes rows to the canonical stored shape and drops untouched blank rows", () => {
    const { aliases, issues } = rowsToAliases([row("a", "!T", "!task"), row("b", "", "  ")]);
    expect(aliases).toEqual({ t: "task" });
    expect(issues).toEqual([]);
  });

  it("flags every row the server would reject, by row id", () => {
    const { issues } = rowsToAliases([
      row("a", "t", "task"),
      row("b", "!t", "done"),
      row("c", "x", ""),
      row("d", "", "task"),
      row("e", "go", "go"),
      row("f", "z", "nope"),
    ]);
    expect(issues).toEqual([
      { rowId: "b", reason: "duplicate" },
      { rowId: "c", reason: "empty" },
      { rowId: "d", reason: "empty" },
      { rowId: "e", reason: "recursive" },
      { rowId: "f", reason: "unknown-target" },
    ]);
  });

  it("flags multi-word rows and aliases that would shadow a built-in command", () => {
    const { aliases, issues } = rowsToAliases([
      row("a", "ts", "timer start"),
      row("b", "!task", "done"),
    ]);
    expect(aliases).toEqual({});
    expect(issues).toEqual([
      { rowId: "a", reason: "multi-word" },
      { rowId: "b", reason: "shadows-builtin" },
    ]);
  });

  it("accepts aliases named after Object.prototype members", () => {
    const { aliases, issues } = rowsToAliases([row("a", "constructor", "task")]);
    expect(issues).toEqual([]);
    expect(Object.hasOwn(aliases, "constructor")).toBe(true);
  });

  it("produces aliases the real save schema accepts whenever it reports no issues", () => {
    const { aliases, issues } = rowsToAliases([row("a", "!t", "!task"), row("b", "!d", "done")]);
    expect(issues).toEqual([]);
    const parsed = updateBotSettingsInput.shape.commandAliases.safeParse(aliases);
    expect(parsed.success).toBe(true);
  });
});
