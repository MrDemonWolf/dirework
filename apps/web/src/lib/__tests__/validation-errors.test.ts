import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { updateStylesInput } from "@dirework/api/routers/input-schemas";

import { DEFAULT_PHASE_LABELS } from "../config-types";
import { defaultTaskStyles, defaultTimerStyles, themePresets } from "../theme-presets";
import { API_UNREACHABLE_MESSAGE } from "../trpc-errors";
import { describeIssues, formatMutationError } from "../validation-errors";

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
