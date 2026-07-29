"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { ConsoleRule } from "@/components/console-rule";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MessageField {
  key: string;
  label: string;
  /** Comma-separated template variables, or "none" */
  placeholder: string;
  /** Console-rule subgroup the field renders under */
  group: string;
}

export const taskMessageFields: {
  key: keyof TaskMessagesConfig;
  label: string;
  placeholder: string;
  group: string;
}[] = [
  { key: "taskAdded", label: "Task added", placeholder: "{task}, {user}", group: "Adding" },
  { key: "noTaskAdded", label: "Task limit reached", placeholder: "{user}", group: "Adding" },
  { key: "noTaskContent", label: "No task text (!task)", placeholder: "{user}", group: "Adding" },
  { key: "taskDone", label: "Task done", placeholder: "{task}, {user}", group: "Completing" },
  {
    key: "taskNext",
    label: "Next task started",
    placeholder: "{oldTask}, {newTask}, {user}",
    group: "Completing",
  },
  {
    key: "nextNoContent",
    label: "No task text (!next)",
    placeholder: "{user}",
    group: "Completing",
  },
  { key: "taskCheck", label: "Task check", placeholder: "{user}, {task}", group: "Completing" },
  {
    key: "taskCheckUser",
    label: "Task check (other user)",
    placeholder: "{user}, {user2}, {task}",
    group: "Completing",
  },
  {
    key: "taskEdited",
    label: "Task edited",
    placeholder: "{task}, {user}",
    group: "Editing & removing",
  },
  {
    key: "taskRemoved",
    label: "Task removed",
    placeholder: "{task}, {user}",
    group: "Editing & removing",
  },
  {
    key: "noTaskToEdit",
    label: "No task to edit",
    placeholder: "{user}",
    group: "Editing & removing",
  },
  { key: "clearedAll", label: "Cleared all", placeholder: "none", group: "Editing & removing" },
  { key: "clearedDone", label: "Cleared done", placeholder: "none", group: "Editing & removing" },
  {
    key: "adminDeleteTasks",
    label: "Mod cleared user's tasks",
    placeholder: "none",
    group: "Editing & removing",
  },
  { key: "noTask", label: "No task", placeholder: "{user}", group: "Errors & limits" },
  {
    key: "noTaskOther",
    label: "No task (other user)",
    placeholder: "{user}",
    group: "Errors & limits",
  },
  { key: "notMod", label: "Not a mod", placeholder: "{user}", group: "Errors & limits" },
  { key: "help", label: "Help", placeholder: "{user}", group: "Errors & limits" },
];

export const timerMessageFields: {
  key: keyof TimerMessagesConfig;
  label: string;
  placeholder: string;
  group: string;
}[] = [
  // Only messages the bot actually sends. The old "Phase changes" group
  // (focus/break/long-break/stream-starting/finished) was removed in the P1
  // cleanup — Workers has no always-on process to fire phase announcements, so
  // those fields were editable and did nothing.
  { key: "commandSuccess", label: "Command success", placeholder: "none", group: "Status" },
  { key: "eta", label: "ETA", placeholder: "{phase}, {time}", group: "Status" },
  { key: "notRunning", label: "Timer not running", placeholder: "none", group: "Errors" },
  { key: "wrongCommand", label: "Unknown command", placeholder: "none", group: "Errors" },
  { key: "timerRunning", label: "Timer already running", placeholder: "none", group: "Errors" },
  { key: "cycleWrong", label: "Invalid cycle count", placeholder: "none", group: "Errors" },
];

/**
 * ONE generic chat-message editor rendered for both the task and timer message
 * sets (audit L15 — replaces the two near-identical editors). Fields render in
 * console-rule subgroups; variable chips insert at the input's cursor.
 */
export function MessageEditor<T extends object>({
  fields,
  idPrefix,
  values,
  onChange,
  disabled,
  disabledNote,
}: {
  fields: { key: Extract<keyof T, string>; label: string; placeholder: string; group: string }[];
  idPrefix: string;
  values: T;
  onChange: (values: T) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const [search, setSearch] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleChange = (key: Extract<keyof T, string>, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const insertVariable = (key: Extract<keyof T, string>, variable: string) => {
    const el = inputRefs.current[key];
    const current = values[key] as string;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    handleChange(key, current.slice(0, start) + variable + current.slice(end));
    // Refocus after the controlled re-render and park the cursor past the insert
    requestAnimationFrame(() => {
      const node = inputRefs.current[key];
      if (!node) return;
      node.focus();
      const cursor = start + variable.length;
      node.setSelectionRange(cursor, cursor);
    });
  };

  const query = search.toLowerCase();
  const filteredFields = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(query) ||
      f.key.toLowerCase().includes(query) ||
      f.group.toLowerCase().includes(query),
  );

  const groups: string[] = [];
  for (const field of filteredFields) {
    if (!groups.includes(field.group)) groups.push(field.group);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8 md:h-8"
          placeholder="Filter messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter messages"
          disabled={disabled}
        />
      </div>

      {disabled && disabledNote && <p className="text-xs text-muted-foreground">{disabledNote}</p>}

      {groups.map((group) => (
        <div key={group} className="space-y-3">
          <ConsoleRule label={group} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredFields
              .filter((field) => field.group === group)
              .map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`${idPrefix}-${field.key}`} className="text-xs font-medium">
                    {field.label}
                  </Label>
                  <Input
                    id={`${idPrefix}-${field.key}`}
                    ref={(node) => {
                      inputRefs.current[field.key] = node;
                    }}
                    value={values[field.key] as string}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    disabled={disabled}
                  />
                  {field.placeholder !== "none" && (
                    <div className="flex flex-wrap gap-1">
                      {field.placeholder.split(", ").map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(field.key, v)}
                          disabled={disabled}
                          aria-label={`Insert ${v} template variable`}
                          className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      {filteredFields.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No messages match &quot;{search}&quot;.
        </p>
      )}
    </div>
  );
}
