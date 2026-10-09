import { describe, it, expect } from "vitest";

import { MAX_CHAT_BYTES, utf8ByteLength } from "../../config-shared";
import { formatEtaDuration, interpolate, parseTaskEditArgs, resolveAlias } from "../commands";

describe("interpolate", () => {
  it("substitutes a single variable", () => {
    expect(interpolate("Hello, {user}!", { user: "Alice" })).toBe("Hello, Alice!");
  });

  it("substitutes multiple variables", () => {
    expect(interpolate('Task "{task}" added for {user}!', { user: "Bob", task: "Fix bug" })).toBe(
      'Task "Fix bug" added for Bob!',
    );
  });

  it("substitutes the same variable multiple times", () => {
    expect(interpolate("{user} {user}", { user: "Carol" })).toBe("Carol Carol");
  });

  it("leaves unknown placeholders intact", () => {
    expect(interpolate("Hello, {user}! Channel: {channel}", { user: "Dave" })).toBe(
      "Hello, Dave! Channel: {channel}",
    );
  });

  it("handles an empty vars map — leaves all placeholders intact", () => {
    expect(interpolate("{user} did {task}", {})).toBe("{user} did {task}");
  });

  it("handles a template with no placeholders", () => {
    expect(interpolate("No placeholders here.", { user: "Eve" })).toBe("No placeholders here.");
  });

  it("handles an empty template", () => {
    expect(interpolate("", { user: "Frank" })).toBe("");
  });

  it("substitutes {phase} and {time} for eta-style messages", () => {
    expect(
      interpolate("This phase ends in {phase} · the hunt is done in {time}", {
        user: "Grace",
        phase: "18m",
        time: "1h 55m",
      }),
    ).toBe("This phase ends in 18m · the hunt is done in 1h 55m");
  });

  it("substitutes {user2} for check-user messages", () => {
    expect(
      interpolate('{user}, {user2} is currently tracking: "{task}"', {
        user: "Alice",
        user2: "Bob",
        task: "Write tests",
      }),
    ).toBe('Alice, Bob is currently tracking: "Write tests"');
  });
});

describe("parseTaskEditArgs", () => {
  it("parses a numbered edit and enforces the task length cap", () => {
    expect(parseTaskEditArgs(["2", "new", "task"])).toEqual({ position: "2", text: "new task" });
    expect(parseTaskEditArgs(["1", "x".repeat(600)])?.text).toHaveLength(500);
    // Capped by code units like the tRPC schema, but never mid-surrogate-pair.
    const emoji = parseTaskEditArgs(["1", `a${"🐺".repeat(300)}`])?.text ?? "";
    expect(emoji).toBe(`a${"🐺".repeat(249)}`);
    expect(emoji.isWellFormed()).toBe(true);
  });

  it("rejects missing, non-numeric, and empty replacement text", () => {
    expect(parseTaskEditArgs([])).toBeNull();
    expect(parseTaskEditArgs(["first", "text"])).toBeNull();
    expect(parseTaskEditArgs(["1", "   "])).toBeNull();
  });
});

describe("formatEtaDuration", () => {
  it("formats minutes-only durations", () => {
    expect(formatEtaDuration(18 * 60_000)).toBe("18m");
  });

  it("formats hour + minute durations", () => {
    expect(formatEtaDuration((60 + 55) * 60_000)).toBe("1h 55m");
  });

  it("formats exact-hour durations without a minutes part", () => {
    expect(formatEtaDuration(2 * 60 * 60_000)).toBe("2h");
  });

  it("rounds partial minutes up", () => {
    expect(formatEtaDuration(17 * 60_000 + 30_000)).toBe("18m");
  });

  it("never goes below 1m, even for zero or negative durations", () => {
    expect(formatEtaDuration(10_000)).toBe("1m");
    expect(formatEtaDuration(0)).toBe("1m");
    expect(formatEtaDuration(-5_000)).toBe("1m");
  });
});

describe("resolveAlias", () => {
  it("returns the resolved command when alias matches", () => {
    expect(resolveAlias("!f", { f: "task" })).toBe("!task");
  });

  it("returns the original command when no alias matches", () => {
    expect(resolveAlias("!done", { f: "task" })).toBe("!done");
  });

  it("returns the original command when aliases is empty", () => {
    expect(resolveAlias("!task", {})).toBe("!task");
  });

  it("matches a lowercase command against lowercase alias keys", () => {
    expect(resolveAlias("!f", { f: "task" })).toBe("!task");
  });

  it("resolves to the first matching alias when multiple could apply", () => {
    const result = resolveAlias("!add", { add: "task", add2: "done" });
    expect(result).toBe("!task");
  });

  it("alias value is lowercased in the result", () => {
    expect(resolveAlias("!go", { go: "TASK" })).toBe("!task");
  });

  it("does not match partial command names", () => {
    expect(resolveAlias("!taskextra", { taskex: "done" })).toBe("!taskextra");
  });

  it("does not match without the ! prefix", () => {
    expect(resolveAlias("f", { f: "task" })).toBe("f");
  });

  it("handles alias key with mixed case", () => {
    // resolveAlias compares command (lowercased) to `!${alias}`.toLowerCase()
    expect(resolveAlias("!f", { F: "task" })).toBe("!task");
  });

  it("never lets a stored alias replace a built-in command", () => {
    // Validation now rejects these keys, but rows saved earlier still exist.
    expect(resolveAlias("!done", { done: "task" })).toBe("!done");
    expect(resolveAlias("!DwHelp", { "!dwhelp": "clear" })).toBe("!DwHelp");
  });

  // ── Regression: the "!!task" double-bang bug ───────────────────────────────
  it("resolves the exact UI example !t → !task (canonical no-! storage)", () => {
    expect(resolveAlias("!t", { t: "task" })).toBe("!task");
  });

  it("resolves legacy !-prefixed storage without producing !!task", () => {
    // Old dashboards persisted keys/values WITH the "!". Must still resolve to
    // a single-bang command, never "!!t"/"!!task".
    expect(resolveAlias("!t", { "!t": "!task" })).toBe("!task");
    expect(resolveAlias("!t", { "!t": "!task" })).not.toContain("!!");
  });
});

describe("interpolate edge cases", () => {
  it("handles nested braces gracefully", () => {
    expect(interpolate("{{user}}", { user: "Alice" })).toBe("{Alice}");
  });

  it("handles special regex characters in values", () => {
    expect(interpolate("{task}", { task: "fix $1 issue" })).toBe("fix $1 issue");
  });

  it("handles numeric variable values", () => {
    expect(interpolate("{count} tasks", { count: "5" })).toBe("5 tasks");
  });

  it("substitutes {oldTask} and {newTask} for next command", () => {
    expect(
      interpolate("{user} finished {oldTask}, now working on {newTask}", {
        user: "Alice",
        oldTask: "Bug fix",
        newTask: "Feature",
      }),
    ).toBe("Alice finished Bug fix, now working on Feature");
  });
});

describe("interpolate never lets a substituted value open the reply with a command", () => {
  it.each([
    ["{task}", { task: "!ban someone" }, "ban someone"],
    ["{task} added", { task: "/me shouts" }, "me shouts added"],
    [
      "{oldTask} done, now {newTask}",
      { oldTask: ".timeout x", newTask: "y" },
      "timeout x done, now y",
    ],
    ["{newTask} is next", { newTask: " !! /me x" }, "me x is next"],
  ])("%s with %j", (template, vars, expected) => {
    expect(interpolate(template, vars)).toBe(expected);
  });

  it("keeps a template that deliberately starts with /me or !", () => {
    expect(interpolate("/me added {task}", { task: "!x" })).toBe("/me added !x");
    expect(interpolate("!{task}", { task: "hi" })).toBe("!hi");
  });

  it("leaves command characters later in the reply alone", () => {
    expect(interpolate("Added: {task}", { task: "!ban x" })).toBe("Added: !ban x");
  });

  it("does not expand inherited object keys", () => {
    expect(interpolate("{constructor} {toString}", {})).toBe("{constructor} {toString}");
  });
});

describe("interpolate keeps long replies inside the chat byte cap", () => {
  const template = 'Task "{task}" added, {user}! Good luck!';

  it("shortens the task text, not the tail with the {user} mention", () => {
    const out = interpolate(template, { user: "LongViewerName", task: "x".repeat(500) });
    expect(utf8ByteLength(out)).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    expect(out.endsWith('…" added, LongViewerName! Good luck!')).toBe(true);
  });

  it("budgets multi-byte task text by bytes without splitting a character", () => {
    const out = interpolate(template, { user: "Bob", task: "🐺".repeat(200) });
    expect(utf8ByteLength(out)).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    expect(out).toMatch(/^Task "(🐺)+…" added, Bob! Good luck!$/u);
  });

  it("gives a short {oldTask} its full text and the rest of the budget to {newTask}", () => {
    const out = interpolate("{user} finished {oldTask}, now on {newTask}. Nice, {user}!", {
      user: "Alice",
      oldTask: "Bug fix",
      newTask: "y".repeat(600),
    });
    expect(utf8ByteLength(out)).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    expect(out.startsWith("Alice finished Bug fix, now on yyy")).toBe(true);
    expect(out.endsWith("…. Nice, Alice!")).toBe(true);
    // The leftover budget went to {newTask} rather than an equal split.
    expect(utf8ByteLength(out)).toBeGreaterThan(MAX_CHAT_BYTES - 5);
  });

  it("splits the budget across a variable used twice", () => {
    const out = interpolate("{task} / {task} — {user}", { user: "Eve", task: "z".repeat(400) });
    expect(utf8ByteLength(out)).toBeLessThanOrEqual(MAX_CHAT_BYTES);
    const [first, second] = out.split(" / ");
    expect(second).toBe(`${first} — Eve`);
  });

  it("leaves a reply that already fits untouched", () => {
    expect(interpolate(template, { user: "Bob", task: "short" })).toBe(
      'Task "short" added, Bob! Good luck!',
    );
  });
});
