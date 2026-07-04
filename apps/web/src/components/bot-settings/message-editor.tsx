"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MessageField {
  key: string;
  label: string;
  /** Comma-separated template variables, or "none" */
  placeholder: string;
}

export const taskMessageFields: { key: keyof TaskMessagesConfig; label: string; placeholder: string }[] = [
  { key: "taskAdded", label: "Task Added", placeholder: "{task}, {user}" },
  { key: "noTaskAdded", label: "No Task Added", placeholder: "{user}" },
  { key: "noTaskContent", label: "No Task Content", placeholder: "{user}" },
  { key: "noTaskToEdit", label: "No Task to Edit", placeholder: "{user}" },
  { key: "taskEdited", label: "Task Edited", placeholder: "{task}, {user}" },
  { key: "taskRemoved", label: "Task Removed", placeholder: "{task}, {user}" },
  { key: "taskNext", label: "Task Next", placeholder: "{oldTask}, {newTask}, {user}" },
  { key: "adminDeleteTasks", label: "Admin Delete Tasks", placeholder: "none" },
  { key: "taskDone", label: "Task Done", placeholder: "{task}, {user}" },
  { key: "taskCheck", label: "Task Check", placeholder: "{user}, {task}" },
  { key: "taskCheckUser", label: "Task Check User", placeholder: "{user}, {user2}, {task}" },
  { key: "noTask", label: "No Task", placeholder: "{user}" },
  { key: "noTaskOther", label: "No Task (Other User)", placeholder: "{user}" },
  { key: "notMod", label: "Not Mod", placeholder: "{user}" },
  { key: "clearedAll", label: "Cleared All", placeholder: "none" },
  { key: "clearedDone", label: "Cleared Done", placeholder: "none" },
  { key: "nextNoContent", label: "Next No Content", placeholder: "{user}" },
  { key: "help", label: "Help", placeholder: "{user}" },
];

export const timerMessageFields: { key: keyof TimerMessagesConfig; label: string; placeholder: string }[] = [
  { key: "workMsg", label: "Work Started", placeholder: "none" },
  { key: "breakMsg", label: "Break Started", placeholder: "none" },
  { key: "longBreakMsg", label: "Long Break Started", placeholder: "none" },
  { key: "workRemindMsg", label: "Work Reminder", placeholder: "{channel}" },
  { key: "notRunning", label: "Not Running", placeholder: "none" },
  { key: "streamStarting", label: "Stream Starting", placeholder: "none" },
  { key: "wrongCommand", label: "Wrong Command", placeholder: "none" },
  { key: "timerRunning", label: "Timer Running", placeholder: "none" },
  { key: "commandSuccess", label: "Command Success", placeholder: "none" },
  { key: "cycleWrong", label: "Cycle Wrong", placeholder: "none" },
  { key: "goalWrong", label: "Goal Wrong", placeholder: "none" },
  { key: "finishResponse", label: "Finish Response", placeholder: "none" },
  { key: "alreadyStarting", label: "Already Starting", placeholder: "none" },
  { key: "eta", label: "ETA", placeholder: "{time}" },
];

/**
 * ONE generic chat-message editor rendered for both the task and timer message
 * sets (audit L15 — replaces the two near-identical editors).
 */
export function MessageEditor<T extends object>({
  fields,
  idPrefix,
  values,
  onChange,
  disabled,
  disabledNote,
}: {
  fields: { key: Extract<keyof T, string>; label: string; placeholder: string }[];
  idPrefix: string;
  values: T;
  onChange: (values: T) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const [search, setSearch] = useState("");

  const handleChange = (key: Extract<keyof T, string>, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const filteredFields = fields.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8"
          placeholder="Filter messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter messages"
        />
      </div>

      {disabled && disabledNote && (
        <p className="text-xs text-muted-foreground">{disabledNote}</p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filteredFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`${idPrefix}-${field.key}`} className="text-xs font-medium">
              {field.label}
            </Label>
            <Input
              id={`${idPrefix}-${field.key}`}
              value={values[field.key] as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              disabled={disabled}
            />
            {field.placeholder !== "none" && (
              <div className="flex flex-wrap gap-1">
                {field.placeholder.split(", ").map((v) => (
                  <code
                    key={v}
                    className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {v}
                  </code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredFields.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          No messages match &quot;{search}&quot;.
        </p>
      )}
    </div>
  );
}
