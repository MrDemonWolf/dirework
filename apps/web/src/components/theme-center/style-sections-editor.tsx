"use client";

// Renders a style editor as four sections (Colors · Typography · Layout · Opacity) from the
// field lists in lib/style-sections.ts. Inside a section, rows are grouped by the overlay
// part they style (Header, Progress ring…), each group a fieldset so a row's short label
// ("Background") is read with its part. Each section's menu resets it to the Default theme.

import { useState } from "react";
import { MoreHorizontal, RotateCcw } from "lucide-react";

import {
  getAtPath,
  resetSection,
  STYLE_SECTIONS,
  type StyleField,
  type StyleSection,
  sectionDiffers,
  setAtPath,
} from "@/lib/style-sections";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionGroup } from "@/components/section-group";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColorInput } from "./color-input";
import { SliderRow, SwitchRow, TextFieldRow } from "./field-row";
import { FontSelect } from "./font-select";
import { OpacitySliderRow } from "./style-field-groups";

function FieldControl<T>({
  field,
  styles,
  onChange,
  idPrefix,
}: {
  field: StyleField<T>;
  styles: T;
  onChange: (styles: T) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.path.replaceAll(".", "-")}`;
  const value = getAtPath(styles, field.path);
  const set = (next: unknown) => onChange(setAtPath(styles, field.path, next));
  const disabled = field.disabled?.(styles) ?? false;

  switch (field.kind) {
    case "color":
      return (
        <ColorInput
          label={field.label}
          id={id}
          hint={field.hint}
          value={value as string}
          onChange={set}
        />
      );
    case "opacity":
      return (
        <OpacitySliderRow label={field.label} id={id} value={value as number} onChange={set} />
      );
    case "length":
      return (
        <TextFieldRow
          label={field.label}
          id={id}
          value={value as string}
          onChange={set}
          unit={field.unit}
          placeholder={field.placeholder}
        />
      );
    case "text":
      return (
        <TextFieldRow
          label={field.label}
          id={id}
          value={value as string}
          onChange={set}
          schema={field.schema}
          invalidHint={field.invalidHint}
        />
      );
    case "slider":
      return (
        <SliderRow
          label={field.label}
          id={id}
          value={value as number}
          onChange={set}
          min={field.min}
          max={field.max}
          disabled={disabled}
          format={field.unit ? (v) => `${v}${field.unit}` : undefined}
        />
      );
    case "switch":
      return <SwitchRow label={field.label} id={id} checked={value as boolean} onChange={set} />;
    case "font":
      return <FontSelect label={field.label} id={id} value={value as string} onChange={set} />;
  }
}

/** Groups in first-appearance order, so the field lists decide the visual order. */
function groupFields<T>(fields: readonly StyleField<T>[]): [string, StyleField<T>[]][] {
  const groups = new Map<string, StyleField<T>[]>();
  for (const field of fields) groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
  return [...groups];
}

export function StyleSectionsEditor<T>({
  styles,
  onChange,
  fields,
  defaults,
  idPrefix,
  overlayName,
}: {
  styles: T;
  onChange: (styles: T) => void;
  fields: readonly StyleField<T>[];
  /** The Default theme's values, which "Reset section" restores. */
  defaults: T;
  /** Prefix for the inputs' ids (`timer-style` → `timer-style-ring-width`). */
  idPrefix: string;
  /** "timer" or "task list", for the reset confirmation. */
  overlayName: string;
}) {
  const [pendingReset, setPendingReset] = useState<(typeof STYLE_SECTIONS)[number] | null>(null);

  return (
    <div className="space-y-3">
      {STYLE_SECTIONS.map((section) => {
        const visible = fields.filter((f) => f.section === section.id && !f.hidden?.(styles));
        const canReset = sectionDiffers(styles, defaults, fields, section.id);
        return (
          <SectionGroup
            key={section.id}
            title={section.title}
            defaultOpen={section.id === "colors"}
            menu={
              <SectionMenu
                title={section.title}
                canReset={canReset}
                onReset={() => setPendingReset(section)}
              />
            }
          >
            <div className="space-y-4">
              {groupFields(visible).map(([group, rows]) => (
                <fieldset key={group} className="min-w-0 space-y-3 border-0 p-0">
                  <legend className="mb-2 text-xs font-semibold text-foreground">{group}</legend>
                  {rows.map((field) => {
                    const note = field.note?.(styles);
                    return (
                      <div key={field.path}>
                        <FieldControl
                          field={field}
                          styles={styles}
                          onChange={onChange}
                          idPrefix={idPrefix}
                        />
                        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
                      </div>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          </SectionGroup>
        );
      })}

      {/* Resetting replaces edits, so it confirms first; it only changes the draft. */}
      <ConfirmDialog
        open={pendingReset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReset(null);
        }}
        title={pendingReset ? `Reset ${pendingReset.title.toLowerCase()}?` : ""}
        description={
          pendingReset
            ? `Every ${pendingReset.noun} in the ${overlayName} style goes back to the Default theme. Nothing reaches your stream until you save.`
            : ""
        }
        confirmLabel="Reset section"
        onConfirm={() => {
          if (pendingReset) onChange(resetSection(styles, defaults, fields, pendingReset.id));
        }}
      />
    </div>
  );
}

function SectionMenu({
  title,
  canReset,
  onReset,
}: {
  title: string;
  canReset: boolean;
  onReset: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${title} section options`}
            className="text-muted-foreground"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card">
        <DropdownMenuItem disabled={!canReset} onClick={onReset}>
          <RotateCcw className="size-3.5" />
          Reset section
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { StyleSection };
