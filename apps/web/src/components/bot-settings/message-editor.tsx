"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import type { TaskMessagesConfig, TimerMessagesConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const taskMessageFields: {
  key: keyof TaskMessagesConfig;
  label: string;
  placeholder: string;
}[] = [
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

const timerMessageFields: {
  key: keyof TimerMessagesConfig;
  label: string;
  placeholder: string;
}[] = [
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

export function TaskMessageEditor({
  messages,
  onChange,
  disabled,
}: {
  messages: TaskMessagesConfig;
  onChange: (messages: TaskMessagesConfig) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const handleChange = (key: keyof TaskMessagesConfig, value: string) => {
    onChange({ ...messages, [key]: value });
  };

  const filteredFields = taskMessageFields.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Filter messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {disabled && (
        <p className="text-xs text-muted-foreground">
          Task commands are disabled — enable them in the sidebar to edit messages.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filteredFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`task-${field.key}`} className="text-xs font-medium">
              {field.label}
            </Label>
            <Input
              id={`task-${field.key}`}
              value={messages[field.key]}
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
    </div>
  );
}

export function TimerMessageEditor({
  messages,
  onChange,
  disabled,
}: {
  messages: TimerMessagesConfig;
  onChange: (messages: TimerMessagesConfig) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const handleChange = (key: keyof TimerMessagesConfig, value: string) => {
    onChange({ ...messages, [key]: value });
  };

  const filteredFields = timerMessageFields.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Filter messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {disabled && (
        <p className="text-xs text-muted-foreground">
          Timer commands are disabled — enable them in the sidebar to edit messages.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filteredFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`timer-${field.key}`} className="text-xs font-medium">
              {field.label}
            </Label>
            <Input
              id={`timer-${field.key}`}
              value={messages[field.key]}
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
    </div>
  );
}
