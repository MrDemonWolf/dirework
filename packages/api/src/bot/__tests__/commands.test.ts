import { describe, it, expect } from "vitest";

import { formatEtaDuration, interpolate, resolveAlias } from "../commands";

describe("interpolate", () => {
  it("substitutes a single variable", () => {
    expect(interpolate("Hello, {user}!", { user: "Alice" })).toBe("Hello, Alice!");
  });

  it("substitutes multiple variables", () => {
    expect(
      interpolate('Task "{task}" added for {user}!', { user: "Bob", task: "Fix bug" }),
    ).toBe('Task "Fix bug" added for Bob!');
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
    expect(interpolate("No placeholders here.", { user: "Eve" })).toBe(
      "No placeholders here.",
    );
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
    expect(resolveAlias("!focus", { focus: "task" })).toBe("!task");
  });

  it("returns the original command when no alias matches", () => {
    expect(resolveAlias("!done", { focus: "task" })).toBe("!done");
  });

  it("returns the original command when aliases is empty", () => {
    expect(resolveAlias("!task", {})).toBe("!task");
  });

  it("matches a lowercase command against lowercase alias keys", () => {
    expect(resolveAlias("!focus", { focus: "task" })).toBe("!task");
  });

  it("resolves to the first matching alias when multiple could apply", () => {
    const result = resolveAlias("!add", { add: "task", add2: "done" });
    expect(result).toBe("!task");
  });

  it("alias value is lowercased in the result", () => {
    expect(resolveAlias("!go", { go: "TASK" })).toBe("!task");
  });

  it("does not match partial command names", () => {
    expect(resolveAlias("!taskextra", { task: "done" })).toBe("!taskextra");
  });

  it("does not match without the ! prefix", () => {
    expect(resolveAlias("focus", { focus: "task" })).toBe("focus");
  });

  it("handles alias key with mixed case", () => {
    // resolveAlias compares command (lowercased) to `!${alias}`.toLowerCase()
    expect(resolveAlias("!focus", { Focus: "task" })).toBe("!task");
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
