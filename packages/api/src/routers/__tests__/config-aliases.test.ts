import { describe, it, expect } from "vitest";

// The REAL router input schema (env-free module) — no hand-copied mirror.
import { commandAliasesInput as commandAliasesSchema } from "../input-schemas";
import { normalizeAliases } from "../../config-shared";

describe("commandAliasesInput validation", () => {
  it("accepts valid aliases", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { f: "task", go: "done" },
    });
    expect(result.commandAliases).toEqual({ f: "task", go: "done" });
  });

  it("accepts empty aliases", () => {
    const result = commandAliasesSchema.parse({ commandAliases: {} });
    expect(result.commandAliases).toEqual({});
  });

  it("rejects alias key longer than 50 characters", () => {
    expect(() =>
      commandAliasesSchema.parse({
        commandAliases: { ["a".repeat(51)]: "task" },
      }),
    ).toThrow();
  });

  it("rejects alias value longer than 100 characters", () => {
    expect(() =>
      commandAliasesSchema.parse({
        commandAliases: { f: "a".repeat(101) },
      }),
    ).toThrow();
  });

  it("rejects more than 50 aliases", () => {
    const aliases: Record<string, string> = {};
    for (let i = 0; i < 51; i++) {
      aliases[`alias${i}`] = "task";
    }
    expect(() => commandAliasesSchema.parse({ commandAliases: aliases })).toThrow(
      "Maximum of 50 command aliases allowed",
    );
  });

  it("accepts exactly 50 aliases", () => {
    const aliases: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      aliases[`alias${i}`] = "task";
    }
    const result = commandAliasesSchema.parse({ commandAliases: aliases });
    expect(Object.keys(result.commandAliases)).toHaveLength(50);
  });

  it("accepts key at exactly 50 characters", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { ["a".repeat(50)]: "task" },
    });
    expect(Object.keys(result.commandAliases)).toHaveLength(1);
  });

  // ── Normalization + semantic validation ───────────────────────────────────
  it("normalizes the UI example {'!t':'!task'} to canonical {t:'task'}", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { "!t": "!task" },
    });
    expect(result.commandAliases).toEqual({ t: "task" });
  });

  it("normalizes mixed-case and whitespace", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { "  !GO ": "  TASK  " },
    });
    expect(result.commandAliases).toEqual({ go: "task" });
  });

  it("rejects a recursive alias (key === target)", () => {
    expect(() => commandAliasesSchema.parse({ commandAliases: { t: "t" } })).toThrow(/recursive/);
  });

  it("rejects an alias named after a built-in command", () => {
    for (const key of ["done", "!Task", "timer", "dwhelp", "dwcommands"]) {
      expect(() => commandAliasesSchema.parse({ commandAliases: { [key]: "next" } })).toThrow(
        /shadows-builtin/,
      );
    }
  });

  it("rejects a multi-word alias or target instead of truncating it", () => {
    expect(() => commandAliasesSchema.parse({ commandAliases: { ts: "!timer start" } })).toThrow(
      /multi-word/,
    );
    expect(() => commandAliasesSchema.parse({ commandAliases: { "a b": "task" } })).toThrow(
      /multi-word/,
    );
  });

  it("rejects an unknown target command", () => {
    expect(() => commandAliasesSchema.parse({ commandAliases: { t: "nope" } })).toThrow(
      /unknown-target/,
    );
  });

  it("rejects duplicate keys that collapse after normalization", () => {
    expect(() =>
      commandAliasesSchema.parse({ commandAliases: { "!t": "task", t: "done" } }),
    ).toThrow(/duplicate/);
  });

  it("rejects an empty target", () => {
    expect(() => commandAliasesSchema.parse({ commandAliases: { t: "!" } })).toThrow(/empty/);
  });

  it("accepts a target that maps to the !timer command", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { pomo: "timer" },
    });
    expect(result.commandAliases).toEqual({ pomo: "timer" });
  });

  it("accepts aliases named after Object.prototype members", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: JSON.parse('{"constructor":"task","__proto__":"done"}'),
    });
    // zod's record parser skips "__proto__"; nothing reaches the prototype.
    expect(Object.entries(result.commandAliases)).toEqual([["constructor", "task"]]);
    expect(Object.getPrototypeOf(result.commandAliases)).toBe(Object.prototype);
  });
});

describe("normalizeAliases", () => {
  it("validates entries without collapsing duplicates and reports each entry's index", () => {
    const { aliases, issues } = normalizeAliases([
      ["!t", "!task"],
      ["T", "done"],
      ["go", ""],
      ["x", "x"],
      ["y", "nope"],
    ]);
    expect(aliases).toEqual({ t: "task" });
    expect(issues).toEqual([
      { key: "t", reason: "duplicate", index: 1 },
      { key: "go", reason: "empty", index: 2 },
      { key: "x", reason: "recursive", index: 3 },
      { key: "y", reason: "unknown-target", index: 4 },
    ]);
  });

  it("does not treat inherited property names as duplicates", () => {
    const { aliases, issues } = normalizeAliases([["constructor", "task"]]);
    expect(issues).toEqual([]);
    expect(Object.hasOwn(aliases, "constructor")).toBe(true);
  });
});
