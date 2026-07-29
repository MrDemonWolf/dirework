import { describe, it, expect } from "vitest";

// The REAL router input schema (env-free module) — no hand-copied mirror.
import { commandAliasesInput as commandAliasesSchema } from "../input-schemas";

describe("config.updateCommandAliases input validation", () => {
  it("accepts valid aliases", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { focus: "task", go: "done" },
    });
    expect(result.commandAliases).toEqual({ focus: "task", go: "done" });
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
        commandAliases: { focus: "a".repeat(101) },
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

  // ── P0.3: normalization + semantic validation ─────────────────────────────
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
    expect(() =>
      commandAliasesSchema.parse({ commandAliases: { task: "task" } }),
    ).toThrow(/recursive/);
  });

  it("rejects an unknown target command", () => {
    expect(() =>
      commandAliasesSchema.parse({ commandAliases: { t: "nope" } }),
    ).toThrow(/unknown-target/);
  });

  it("rejects duplicate keys that collapse after normalization", () => {
    expect(() =>
      commandAliasesSchema.parse({ commandAliases: { "!t": "task", t: "done" } }),
    ).toThrow(/duplicate/);
  });

  it("rejects an empty target", () => {
    expect(() =>
      commandAliasesSchema.parse({ commandAliases: { t: "!" } }),
    ).toThrow(/empty/);
  });

  it("accepts a target that maps to the !timer command", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { pomo: "timer" },
    });
    expect(result.commandAliases).toEqual({ pomo: "timer" });
  });
});
