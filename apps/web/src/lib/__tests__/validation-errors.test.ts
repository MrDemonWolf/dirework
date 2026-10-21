import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { updateStylesInput } from "@dirework/api/routers/input-schemas";

import { DEFAULT_PHASE_LABELS } from "../config-types";
import { defaultTaskStyles, defaultTimerStyles, themePresets } from "../theme-presets";
import { API_UNREACHABLE_MESSAGE } from "../trpc-errors";
import { describeFieldIssues, describeIssues, formatMutationError } from "../validation-errors";

function invalidStylesError() {
  const result = updateStylesInput.safeParse({
    timerStyles: { ...defaultTimerStyles, dimensions: { width: "320", height: "1;}" } },
    taskStyles: defaultTaskStyles,
    phaseLabels: DEFAULT_PHASE_LABELS,
  });
  if (result.success) throw new Error("expected the styles payload to be rejected");
  return result.error;
}

describe("describeIssues", () => {
  it("names the first failing field in words and counts the rest", () => {
    expect(describeIssues(invalidStylesError().issues)).toBe(
      "timer styles › dimensions › width: Invalid CSS length (+1 more)",
    );
  });

  it("falls back for an empty list or a path-less issue", () => {
    expect(describeIssues([])).toBe("Invalid input");
    expect(describeIssues([{ path: [], message: "Bad" }])).toBe("Bad");
  });
});

describe("describeFieldIssues", () => {
  const label = (path: readonly PropertyKey[]) =>
    path[0] === "task" ? { label: "Task added", id: "task-taskAdded" } : null;

  it("names a resolved field by its label and rewrites the byte cap as the chat limit", () => {
    const { text, field } = describeFieldIssues(
      [{ path: ["task", "taskAdded"], message: "Message must be at most 300 bytes" }],
      label,
    );
    expect(text).toBe("'Task added' is over the 300-byte chat limit");
    expect(field?.id).toBe("task-taskAdded");
  });

  it("words control characters and other messages against the label", () => {
    expect(
      describeFieldIssues(
        [{ path: ["task"], message: "Message must not contain control characters" }],
        label,
      ).text,
    ).toBe("'Task added' contains a control character");
    expect(describeFieldIssues([{ path: ["task"], message: "Too long" }], label).text).toBe(
      "'Task added': Too long",
    );
  });

  it("falls back to the path in words for a field it can't name", () => {
    const issues = invalidStylesError().issues;
    expect(describeFieldIssues(issues, label)).toEqual({
      text: describeIssues(issues),
      field: null,
    });
    expect(describeFieldIssues([], label)).toEqual({ text: "Invalid input", field: null });
  });
});

describe("formatMutationError", () => {
  it("turns a serialized zod issue list into one readable line", () => {
    expect(formatMutationError({ message: invalidStylesError().message })).toBe(
      "timer styles › dimensions › width: Invalid CSS length (+1 more)",
    );
  });

  it("passes ordinary messages through unchanged", () => {
    expect(formatMutationError({ message: "Config row not found" })).toBe("Config row not found");
    expect(formatMutationError({ message: "[not json" })).toBe("[not json");
    expect(formatMutationError({ message: "[1, 2]" })).toBe("[1, 2]");
  });

  it("shows the connection message for a transport failure", () => {
    const transport = TRPCClientError.from(new SyntaxError("Unexpected token '<'"));
    expect(formatMutationError(transport)).toBe(API_UNREACHABLE_MESSAGE);
    expect(formatMutationError(undefined)).toBe(API_UNREACHABLE_MESSAGE);
  });
});

describe("Theme Center save schema", () => {
  it("accepts every shipped preset, so applying one never blocks Save", () => {
    for (const preset of themePresets) {
      const result = updateStylesInput.safeParse({
        timerStyles: preset.timerStyles,
        taskStyles: preset.taskStyles,
        phaseLabels: DEFAULT_PHASE_LABELS,
      });
      expect(result.success, preset.id).toBe(true);
    }
  });
});
