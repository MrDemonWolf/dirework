"use client";

import type { MessagesConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionGroup } from "@/components/theme-center/section-group";

const messageFields: {
  key: keyof MessagesConfig;
  label: string;
  placeholders: string;
}[] = [
  { key: "taskAdded", label: "Task Added", placeholders: "{user}" },
  { key: "taskDone", label: "Task Done", placeholders: "{user}" },
  { key: "taskEdited", label: "Task Edited", placeholders: "{user}" },
  { key: "taskRemoved", label: "Task Removed", placeholders: "{user}" },
  { key: "noTasks", label: "No Tasks", placeholders: "{user}" },
  {
    key: "timerStarted",
    label: "Timer Started",
    placeholders: "{duration}",
  },
  { key: "timerPaused", label: "Timer Paused", placeholders: "none" },
  { key: "timerResumed", label: "Timer Resumed", placeholders: "none" },
];

export function MessageEditor({
  messages,
  onChange,
}: {
  messages: MessagesConfig;
  onChange: (messages: MessagesConfig) => void;
}) {
  const handleChange = (key: keyof MessagesConfig, value: string) => {
    onChange({ ...messages, [key]: value });
  };

  return (
    <SectionGroup title="Bot Messages">
      {messageFields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key} className="text-xs font-medium">
            {field.label}
          </Label>
          <Input
            id={field.key}
            value={messages[field.key]}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Placeholders: {field.placeholders}
          </p>
        </div>
      ))}
    </SectionGroup>
  );
}
