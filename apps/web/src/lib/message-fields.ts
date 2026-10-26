// Field lists for the Bot settings reply editors: label, group and the variables each task or
// timer message may use. Pure data, so tests can import it without pulling in the editor.

import type { TemplateVariableName } from "@dirework/api/chat-text";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";

/** Editor metadata for one message template key. */
export interface MessageField<K extends string = string> {
  key: K;
  label: string;
  /** Variables the handler passes for this reply, offered as insert chips. */
  variables: readonly TemplateVariableName[];
  /** Console-rule subgroup the field renders under */
  group: string;
}

/**
 * Fields for the task message set, in display order. `as const satisfies` keeps the literal
 * keys (needed by the coverage check below) while type-checking each entry.
 */
export const taskMessageFields = [
  // First, in its own group: the reply a brand-new viewer reads. `!dw help` always answers
  // with the built-in guide, so rewording this never leaves chat without one.
  {
    key: "help",
    label: "Viewer starter guide (!help)",
    variables: ["user"],
    group: "Viewer help",
  },
  { key: "taskAdded", label: "Task added", variables: ["task", "user"], group: "Adding" },
  { key: "noTaskAdded", label: "Task limit reached", variables: ["user"], group: "Adding" },
  { key: "noTaskContent", label: "No task text (!task)", variables: ["user"], group: "Adding" },
  { key: "taskDone", label: "Task done", variables: ["task", "user"], group: "Completing" },
  {
    key: "taskNext",
    label: "Next task started",
    variables: ["oldTask", "newTask", "user"],
    group: "Completing",
  },
  { key: "nextNoContent", label: "No task text (!next)", variables: ["user"], group: "Completing" },
  { key: "taskCheck", label: "Task check", variables: ["user", "task"], group: "Completing" },
  {
    key: "taskCheckUser",
    label: "Task check (other user)",
    variables: ["user", "user2", "task"],
    group: "Completing",
  },
  {
    key: "taskStarted",
    label: "Task started",
    variables: ["task", "user", "count", "max"],
    group: "Starting & pausing",
  },
  {
    key: "taskStartedFocus",
    label: "Task started as focus",
    variables: ["task", "user"],
    group: "Starting & pausing",
  },
  {
    key: "startCapReached",
    label: "Too many going (!start)",
    variables: ["user", "max"],
    group: "Starting & pausing",
  },
  {
    key: "noTaskToStart",
    label: "Nothing to start",
    variables: ["user"],
    group: "Starting & pausing",
  },
  {
    key: "taskPaused",
    label: "Task paused",
    variables: ["task", "user"],
    group: "Starting & pausing",
  },
  {
    key: "noTaskToPause",
    label: "Nothing to pause",
    variables: ["user"],
    group: "Starting & pausing",
  },
  {
    key: "taskEdited",
    label: "Task edited",
    variables: ["task", "user"],
    group: "Editing & removing",
  },
  {
    key: "taskRemoved",
    label: "Task removed",
    variables: ["task", "user"],
    group: "Editing & removing",
  },
  {
    key: "noTaskToEdit",
    label: "No task to edit",
    variables: ["user"],
    group: "Editing & removing",
  },
  { key: "clearedAll", label: "Cleared all", variables: [], group: "Editing & removing" },
  { key: "clearedDone", label: "Cleared done", variables: [], group: "Editing & removing" },
  {
    key: "adminDeleteTasks",
    label: "Mod cleared a user's tasks",
    variables: [],
    group: "Editing & removing",
  },
  { key: "noTask", label: "No task", variables: ["user"], group: "Errors & limits" },
  {
    key: "noTaskOther",
    label: "No task (other user)",
    variables: ["user"],
    group: "Errors & limits",
  },
  { key: "notMod", label: "Not a mod", variables: ["user"], group: "Errors & limits" },
] as const satisfies readonly MessageField<keyof TaskMessagesConfig>[];

/** Fields for the timer message set, in display order. */
export const timerMessageFields = [
  // Only messages the bot actually sends. The old "Phase changes" group
  // (focus/break/long-break/stream-starting/finished) was removed in the P1
  // cleanup — Workers has no always-on process to fire phase announcements, so
  // those fields were editable and did nothing.
  { key: "commandSuccess", label: "Command success", variables: [], group: "Status" },
  { key: "eta", label: "ETA", variables: ["phase", "time"], group: "Status" },
  { key: "notRunning", label: "Timer not running", variables: [], group: "Errors" },
  { key: "wrongCommand", label: "Unknown command", variables: [], group: "Errors" },
  { key: "timerRunning", label: "Timer already running", variables: [], group: "Errors" },
  { key: "cycleWrong", label: "Invalid cycle count", variables: [], group: "Errors" },
] as const satisfies readonly MessageField<keyof TimerMessagesConfig>[];

/**
 * The chat commands whose replies each group holds, shown in the group's header on the
 * Replies page so a reply can be found by the command that sends it.
 */
export const TASK_MESSAGE_GROUP_COMMANDS: Record<
  (typeof taskMessageFields)[number]["group"],
  string
> = {
  "Viewer help": "!help",
  Adding: "!task",
  Completing: "!done !next !check",
  "Starting & pausing": "!start !pause",
  "Editing & removing": "!edit !remove !clear",
  "Errors & limits": "any task command",
};

export const TIMER_MESSAGE_GROUP_COMMANDS: Record<
  (typeof timerMessageFields)[number]["group"],
  string
> = {
  Status: "!timer start, pause, skip, eta…",
  Errors: "any !timer command",
};

/** Message keys (from config-shared) that have no editor field above. */
type UncoveredKeys<K, F extends readonly { key: unknown }[]> = Exclude<K, F[number]["key"]>;

// Compile-time coverage: a message key added to config-shared without an
// editor field here fails type-checking instead of silently being uneditable.
const _allMessageKeysEditable: [
  UncoveredKeys<keyof TaskMessagesConfig, typeof taskMessageFields>,
  UncoveredKeys<keyof TimerMessagesConfig, typeof timerMessageFields>,
] extends [never, never]
  ? true
  : never = true;
