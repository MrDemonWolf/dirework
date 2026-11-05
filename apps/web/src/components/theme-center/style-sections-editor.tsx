"use client";

// Renders a style editor as four sections (Colors · Typography · Layout · Opacity) from the
// field lists in lib/style-sections.ts. Inside a section, rows are grouped by the overlay
// part they style (Header, Progress ring…), each group a fieldset so a row's short label
// ("Background") is read with its part; on a wide editor the groups flow into two columns.
// Each section's menu resets it to the Default theme.
//
// Every edit is an updater on the page's draft (`onChange` is its state setter), so no row
// or menu callback closes over `styles`: the React Compiler reuses each unchanged row's
// control element and each section menu across an edit, so only the changed row re-renders.

import { type Dispatch, type SetStateAction, useState } from "react";
import { MoreHorizontal, RotateCcw } from "lucide-react";

import type { OverlayIcon as OverlayIconId } from "@dirework/api/style-limits";

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
import { IconPickerRow } from "./icon-picker";
import { OpacitySliderRow } from "./style-field-groups";

function FieldControl<T>({
  field,
  styles,
  onChange,
  idPrefix,
}: {
  field: StyleField<T>;
  styles: T;
  onChange: Dispatch<SetStateAction<T>>;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.path.replaceAll(".", "-")}`;
  const value = getAtPath(styles, field.path);
  // Applied to the draft as React holds it, never to the `styles` this row rendered with.
  const set = (next: unknown) => onChange((prev) => setAtPath(prev, field.path, next));
  const disabled = field.disabled?.(styles) ?? false;
  const hint = (typeof field.hint === "function" ? field.hint(styles) : field.hint) ?? undefined;

  switch (field.kind) {
    case "color":
      return (
        <ColorInput
          label={field.label}
          id={id}
          hint={hint}
          value={value as string}
          onChange={set}
        />
      );
    case "opacity":
      return (
        <OpacitySliderRow
          label={field.label}
          id={id}
          value={value as number}
          onChange={set}
          hint={hint}
        />
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
          hint={hint}
          limit={field.limit}
          steppable
        />
      );
    case "icon":
      return (
        <IconPickerRow
          label={field.label}
          id={id}
          value={value as OverlayIconId}
          onChange={set}
          hint={hint}
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
          hint={hint}
          format={field.unit ? (v) => `${v}${field.unit}` : undefined}
        />
      );
    case "switch":
      return (
        <SwitchRow
          label={field.label}
          id={id}
          checked={value as boolean}
          onChange={set}
          hint={hint}
        />
      );
    case "font":
      return (
        <FontSelect
          label={field.label}
          id={id}
          value={value as string}
          onChange={set}
          hint={hint}
        />
      );
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
  /** The page's draft setter: every edit is an updater, `(prev) => next`. */
  onChange: Dispatch<SetStateAction<T>>;
  fields: readonly StyleField<T>[];
  /** The Default theme's values, which "Reset section" restores. */
  defaults: T;
  /** Prefix for the inputs' ids (`timer-style` → `timer-style-ring-width`). */
  idPrefix: string;
  /** "timer" or "task list", for the reset confirmation. */
  overlayName: string;
}) {
  const [pendingReset, setPendingReset] = useState<StyleSection | null>(null);
  const pending = STYLE_SECTIONS.find((section) => section.id === pendingReset);

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
                section={section.id}
                title={section.title}
                canReset={canReset}
                onReset={setPendingReset}
              />
            }
          >
            {/* Groups flow into two balanced columns once the editor is wide enough (a
                container query: the column's width depends on the preview rail, not the
                viewport), and a group never splits. A lone column caps at max-w-md, so a
                label never sits a screen's width from its control. */}
            <div className="@container">
              <div className="@2xl:columns-2 @2xl:gap-8">
                {groupFields(visible).map(([group, rows]) => (
                  <fieldset
                    key={group}
                    className="mb-6 min-w-0 max-w-md break-inside-avoid last:mb-0 space-y-2.5 border-0 p-0"
                  >
                    <legend className="mb-3 w-full border-b border-border pb-1.5 text-sm font-semibold text-foreground">
                      {group}
                    </legend>
                    {rows.map((field) => (
                      <FieldControl
                        key={field.path}
                        field={field}
                        styles={styles}
                        onChange={onChange}
                        idPrefix={idPrefix}
                      />
                    ))}
                  </fieldset>
                ))}
              </div>
            </div>
          </SectionGroup>
        );
      })}

      {/* Resetting replaces edits, so it confirms first; it only changes the draft. */}
      <ConfirmDialog
        open={pending !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingReset(null);
        }}
        title={pending ? `Reset ${pending.title.toLowerCase()}?` : ""}
        description={
          pending
            ? `Every ${pending.noun} in the ${overlayName} style goes back to the Default theme. Nothing reaches your stream until you save.`
            : ""
        }
        confirmLabel="Reset section"
        onConfirm={() => {
          if (pendingReset) onChange((prev) => resetSection(prev, defaults, fields, pendingReset));
        }}
      />
    </div>
  );
}

function SectionMenu({
  section,
  title,
  canReset,
  onReset,
}: {
  section: StyleSection;
  title: string;
  canReset: boolean;
  /** Asks to reset `section`: the editor's state setter, the same function every render. */
  onReset: (section: StyleSection) => void;
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
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={!canReset} onClick={() => onReset(section)}>
          <RotateCcw className="size-3.5" />
          Reset section
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { StyleSection };
