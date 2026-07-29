"use client";

import type { PhaseLabelsConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionGroup } from "@/components/theme-center/section-group";

const labelFields: {
  key: keyof PhaseLabelsConfig;
  label: string;
  description: string;
}[] = [
  { key: "idle", label: "Idle", description: "Shown when the timer is ready to start" },
  {
    key: "starting",
    label: "Starting",
    description: "Shown during the countdown before focus starts",
  },
  { key: "work", label: "Focus", description: "Shown during focus sessions" },
  { key: "break", label: "Break", description: "Shown during short breaks" },
  { key: "longBreak", label: "Long break", description: "Shown during long breaks" },
  { key: "paused", label: "Paused", description: "Shown while the timer is paused" },
  { key: "finished", label: "Finished", description: "Shown when all pomos are done" },
];

export function PhaseLabelsEditor({
  labels,
  onChange,
}: {
  labels: PhaseLabelsConfig;
  onChange: (labels: PhaseLabelsConfig) => void;
}) {
  const handleChange = (key: keyof PhaseLabelsConfig, value: string) => {
    onChange({ ...labels, [key]: value });
  };

  return (
    <SectionGroup title="Phase labels">
      <p className="text-xs text-muted-foreground">
        Customize the text shown on the timer overlay for each phase.
      </p>
      {labelFields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`label-${field.key}`} className="text-xs font-medium">
            {field.label}
          </Label>
          <Input
            id={`label-${field.key}`}
            value={labels[field.key]}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{field.description}</p>
        </div>
      ))}
    </SectionGroup>
  );
}
