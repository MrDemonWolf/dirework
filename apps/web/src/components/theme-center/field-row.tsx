"use client";

import { cssLengthSchema } from "@dirework/api/config-shared";

import { stepLength, withDefaultUnit } from "@/lib/style-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/**
 * The `aria-describedby` for a row's control: the row's hint whenever it has one, plus
 * its error while invalid. Ids are `{id}-hint` / `{id}-error`, as `FieldRow` renders them.
 */
export function fieldDescribedBy(id: string, hint: string | undefined, invalid = false) {
  return [hint && `${id}-hint`, invalid && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

/**
 * Shared editor row primitives: one alignment grid for every control in the style
 * editors. The label (and its optional hint) takes the free space; every control sits
 * in the same fixed `w-44` column right after it, so colors, lengths, fonts and sliders
 * line up and their left edges form one column. The editor caps a group's width
 * (style-sections-editor.tsx), so the label never drifts far from its control.
 */
export function FieldRow({
  label,
  id,
  labelledBy = false,
  error,
  hint,
  children,
}: {
  label: string;
  /** The control's id; the label points at it, and the hint and error ids derive from it. */
  id: string;
  /**
   * For a non-labelable control (Slider): the label gets the id `{id}-label` for the
   * control's aria-labelledby instead of pointing at it with htmlFor.
   */
  labelledBy?: boolean;
  /** Inline validation message under the row (`{id}-error`). */
  error?: string | null;
  /** One line under the label saying what the field changes (`{id}-hint`). */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-8 items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Label
            htmlFor={labelledBy ? undefined : id}
            id={labelledBy ? `${id}-label` : undefined}
            className="text-sm leading-tight text-foreground"
          >
            {label}
          </Label>
          {hint && (
            <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
        <div className="flex w-44 shrink-0 items-center justify-end gap-2">{children}</div>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Free-text CSS value row. Validated inline against the same allowlist the server
 * applies (a CSS length unless `schema` says otherwise), so a bad value is flagged at
 * the field instead of failing the whole save. The value is shown whole ("20px",
 * "12px 18px"), so the unit lives in the field, never beside it: a bare number gets
 * `unit` on blur, and with `steppable` ArrowUp/ArrowDown nudge a single length by 1
 * (Shift: 10), keeping its unit.
 */
export function TextFieldRow({
  label,
  id,
  value,
  onChange,
  unit,
  placeholder,
  hint,
  steppable = false,
  schema = cssLengthSchema,
  invalidHint = "Use a CSS length like 12px, 50% or 1.5rem",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  hint?: string;
  steppable?: boolean;
  schema?: { safeParse: (value: string) => { success: boolean } };
  invalidHint?: string;
}) {
  const invalid = !schema.safeParse(value).success;
  return (
    <FieldRow label={label} id={id} error={invalid ? invalidHint : null} hint={hint}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const next = withDefaultUnit(value, unit);
          if (next !== value) onChange(next);
        }}
        onKeyDown={(e) => {
          if (!steppable || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
          const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
          const next = stepLength(value, step, unit);
          if (next === null) return;
          e.preventDefault();
          onChange(next);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={fieldDescribedBy(id, hint, invalid)}
        className="font-mono tabular-nums"
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
    </FieldRow>
  );
}

/** Slider row with a fixed-width mono readout so values don't jitter. */
export function SliderRow({
  label,
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  format,
  hint,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  format?: (value: number) => string;
  hint?: string;
}) {
  // Slider isn't a labelable element — htmlFor can't reach it (WCAG 4.1.2),
  // so the label carries an id and the slider points back via aria-labelledby.
  return (
    <FieldRow label={label} id={id} labelledBy hint={hint}>
      <Slider
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={fieldDescribedBy(id, hint)}
        // Announce the same unit the readout shows ("40%", not a bare "40")
        getAriaValueText={(_formatted, v) => (format ? format(v) : String(v))}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        min={min}
        max={max}
        disabled={disabled}
        className="min-w-0 flex-1"
      />
      <span className="w-11 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
        {format ? format(value) : value}
      </span>
    </FieldRow>
  );
}

/** Toggle row — the switch sits at the end of the control column. */
export function SwitchRow({
  label,
  id,
  checked,
  onChange,
  hint,
}: {
  label: string;
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <FieldRow label={label} id={id} hint={hint}>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v as boolean)}
        aria-describedby={fieldDescribedBy(id, hint)}
        size="sm"
      />
    </FieldRow>
  );
}
