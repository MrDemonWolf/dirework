import { describe, expect, it } from "vitest";

import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import {
  type AliasRow,
  aliasesToRows,
  aliasIssueMessage,
  nextAliasRowId,
  rowsToAliases,
} from "../alias-rows";

const row = (id: string, key: string, value: string): AliasRow => ({ id, key, value });

describe("aliasesToRows", () => {
  it("derives the same ids on every call, so SSR and hydration agree", () => {
    const first = aliasesToRows({ t: "task", d: "done" });
    const second = aliasesToRows({ t: "task", d: "done" });
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });

  it("never reuses an id a newly added row could get", () => {
    const saved = aliasesToRows({ t: "task" }).map((row) => row.id);
    expect(saved).not.toContain(nextAliasRowId());
  });

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

  it("flags every row the server would reject, by row id and field", () => {
    const { issues } = rowsToAliases([
      row("a", "t", "task"),
      row("b", "!t", "done"),
      row("c", "x", ""),
      row("d", "", "task"),
      row("e", "go", "go"),
      row("f", "z", "nope"),
    ]);
    expect(issues).toEqual([
      { rowId: "b", field: "key", reason: "duplicate" },
      { rowId: "c", field: "value", reason: "empty" },
      { rowId: "d", field: "key", reason: "empty" },
      // "go" -> "go" is recursive AND "go" is no command: both inputs are wrong.
      { rowId: "e", field: "key", reason: "recursive" },
      { rowId: "e", field: "value", reason: "unknown-target" },
      { rowId: "f", field: "value", reason: "unknown-target" },
    ]);
  });

  it("flags multi-word rows and aliases that would shadow a built-in command", () => {
    const { aliases, issues } = rowsToAliases([
      row("a", "ts", "timer start"),
      row("b", "!task", "done"),
    ]);
    expect(aliases).toEqual({});
    expect(issues).toEqual([
      { rowId: "a", field: "value", reason: "multi-word" },
      { rowId: "b", field: "key", reason: "shadows-builtin" },
    ]);
  });

  it("reports the alias and the command separately when both are wrong", () => {
    const { aliases, issues } = rowsToAliases([
      row("a", "t", "task"),
      row("b", "!task", "nope"),
      row("c", "two words", "also two"),
      row("d", "t", "nope"),
    ]);
    expect(aliases).toEqual({ t: "task" });
    expect(issues).toEqual([
      { rowId: "b", field: "key", reason: "shadows-builtin" },
      { rowId: "b", field: "value", reason: "unknown-target" },
      { rowId: "c", field: "key", reason: "multi-word" },
      { rowId: "c", field: "value", reason: "multi-word" },
      { rowId: "d", field: "key", reason: "duplicate" },
      { rowId: "d", field: "value", reason: "unknown-target" },
    ]);
  });

  it("only flags rows the shared validator rejects", () => {
    // Row b repeats a's alias, but a is rejected (bad target) and never stored, so the
    // validator accepts b: the per-field pass must not invent a duplicate for it.
    const { aliases, issues } = rowsToAliases([row("a", "t", "nope"), row("b", "t", "task")]);
    expect(aliases).toEqual({ t: "task" });
    expect(issues).toEqual([{ rowId: "a", field: "value", reason: "unknown-target" }]);
  });

  it("has copy for every field a reason can land on", () => {
    expect(aliasIssueMessage("key", "duplicate")).toMatch(/Duplicate alias/);
    expect(aliasIssueMessage("value", "unknown-target")).toMatch(/Unknown command/);
    expect(aliasIssueMessage("key", "empty")).toMatch(/alias/);
    expect(aliasIssueMessage("value", "empty")).toMatch(/command/);
    expect(aliasIssueMessage("value", "multi-word")).toMatch(/arguments/);
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
