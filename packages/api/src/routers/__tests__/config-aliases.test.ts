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

  it("accepts value at exactly 100 characters", () => {
    const result = commandAliasesSchema.parse({
      commandAliases: { focus: "a".repeat(100) },
    });
    expect(result.commandAliases.focus).toHaveLength(100);
  });
});
