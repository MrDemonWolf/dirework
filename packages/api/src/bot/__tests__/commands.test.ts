import { describe, it, expect } from "vitest";

import { interpolate, resolveAlias } from "../commands";

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

  it("substitutes {time} for eta-style messages", () => {
    expect(interpolate("The hunt will end at {time}", { user: "Grace", time: "5:30 PM" })).toBe(
      "The hunt will end at 5:30 PM",
    );
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
});
