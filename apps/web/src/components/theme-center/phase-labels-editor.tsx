"use client";

// Theme Center editor for the timer overlay's per-phase label text.

import { PHASE_LABEL_MAX_GRAPHEMES } from "@dirework/api/style-limits";

import type { PhaseLabelsConfig } from "@/lib/config-types";
import { phaseLabelBudget } from "@/lib/message-budget";
import { ByteBudget } from "@/components/byte-budget";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionGroup } from "@/components/section-group";

// One row per timer phase, in phase order; `key` is the PhaseLabelsConfig field.
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

/**
 * Controlled editor for all seven phase labels. Each label is validated server-side by
 * `phaseLabelSchema`: at most PHASE_LABEL_MAX_GRAPHEMES characters (as a person counts
 * them, so an emoji is one) and PHASE_LABEL_MAX_BYTES UTF-8 bytes, so the line fits the
 * timer ring. From 80% of either cap the field shows a counter (`phaseLabelBudget`, the
 * tighter of the two) and flags `aria-invalid` when over; Save is blocked meanwhile.
 */
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
        Customize the text shown on the timer overlay for each phase, up to{" "}
        {PHASE_LABEL_MAX_GRAPHEMES} characters each.
      </p>
      {labelFields.map((field) => {
        const id = `label-${field.key}`;
        const budget = phaseLabelBudget(labels[field.key]);
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-medium">
              {field.label}
            </Label>
            <Input
              id={id}
              value={labels[field.key]}
              onChange={(e) => handleChange(field.key, e.target.value)}
              aria-invalid={budget.over || undefined}
              aria-describedby={budget.nearLimit ? `${id}-desc ${id}-bytes` : `${id}-desc`}
            />
            <ByteBudget id={`${id}-bytes`} budget={budget} />
            <p id={`${id}-desc`} className="text-xs text-muted-foreground">
              {field.description}
            </p>
          </div>
        );
      })}
    </SectionGroup>
  );
}
