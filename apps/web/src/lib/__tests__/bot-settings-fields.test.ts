import { describe, expect, it } from "vitest";

import { updateBotSettingsInput } from "@dirework/api/routers/input-schemas";

import { botMessageFieldFor, invalidMessageKeys } from "../bot-settings-fields";
import { DEFAULT_TASK_MESSAGES, DEFAULT_TIMER_MESSAGES } from "../config-types";
import { describeFieldIssues } from "../validation-errors";

/** The real save schema's issues for a payload with one or more bad replies. */
function saveIssues(task: Partial<typeof DEFAULT_TASK_MESSAGES>, timer = {}) {
  const result = updateBotSettingsInput.safeParse({
    taskCommandsEnabled: true,
    timerCommandsEnabled: true,
    task: { ...DEFAULT_TASK_MESSAGES, ...task },
    timer: { ...DEFAULT_TIMER_MESSAGES, ...timer },
    commandAliases: {},
  });
  if (result.success) throw new Error("expected the bot settings payload to be rejected");
  return result.error.issues;
}

describe("botMessageFieldFor", () => {
  it("maps a reply path to its label, input id and tab", () => {
    expect(botMessageFieldFor(["task", "taskAdded"])).toEqual({
      label: "Task added",
      fieldId: "task-taskAdded",
      tab: "task",
    });
    expect(botMessageFieldFor(["timer", "eta"])?.tab).toBe("timer");
  });

  it("returns null for anything that isn't a reply field", () => {
    expect(botMessageFieldFor(["commandAliases"])).toBeNull();
    expect(botMessageFieldFor(["task", "nope"])).toBeNull();
    expect(botMessageFieldFor([])).toBeNull();
  });
});

describe("Save bar wording for bot settings", () => {
  it("names an over-budget reply by its label and the chat limit", () => {
    const { text, field } = describeFieldIssues(
      saveIssues({ taskAdded: "x".repeat(301) }),
      botMessageFieldFor,
    );
    expect(text).toBe("'Task added' is over the 300-byte chat limit");
    expect(field?.fieldId).toBe("task-taskAdded");
  });

  it("counts the rest and lists every invalid key per tab", () => {
    const issues = saveIssues(
      { taskAdded: "x".repeat(301), taskDone: "y".repeat(301) },
      { eta: "z".repeat(301) },
    );
    expect(describeFieldIssues(issues, botMessageFieldFor).text).toMatch(/\(\+2 more\)$/);
    expect([...invalidMessageKeys(issues, "task")].sort()).toEqual(["taskAdded", "taskDone"]);
    expect([...invalidMessageKeys(issues, "timer")]).toEqual(["eta"]);
  });
});
