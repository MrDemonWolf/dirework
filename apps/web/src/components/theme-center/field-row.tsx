"use client";

import { cssLengthSchema } from "@dirework/api/config-shared";

import { withDefaultUnit } from "@/lib/style-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/**
 * Shared editor row primitives — one alignment grid for every control in the
 * style editors: label column left, right-aligned control cluster.
 */
export function FieldRow({
  label,
  htmlFor,
  labelId,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** For non-labelable controls (Slider) that need aria-labelledby instead of htmlFor. */
  labelId?: string;
  /** Inline validation message under the row; the control points at it via aria-describedby. */
  error?: string | null;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="grid min-h-8 grid-cols-[5rem_1fr] items-center gap-2 md:grid-cols-[6.5rem_1fr]">
        <Label htmlFor={htmlFor} id={labelId} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <div className="flex items-center justify-end gap-2">{children}</div>
      </div>
      {error && (
        <p id={errorId} className="text-right text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Free-text CSS value row — optional unit hint rendered as a console label.
 * Validated inline against the same allowlist the server applies (a CSS length
 * unless `schema` says otherwise), so a bad value is flagged at the field
 * instead of failing the whole save. A bare number gets the shown unit on blur.
 */
export function TextFieldRow({
  label,
  id,
  value,
  onChange,
  unit,
  placeholder,
  schema = cssLengthSchema,
  invalidHint = "Use a CSS length like 12px, 50% or 1.5rem",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  schema?: { safeParse: (value: string) => { success: boolean } };
  invalidHint?: string;
}) {
  const invalid = !schema.safeParse(value).success;
  const errorId = `${id}-error`;
  return (
    <FieldRow label={label} htmlFor={id} error={invalid ? invalidHint : null} errorId={errorId}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const next = withDefaultUnit(value, unit);
          if (next !== value) onChange(next);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="h-9 w-28 text-right md:h-8"
        placeholder={placeholder}
      />
      {unit && <span className="console-label">{unit}</span>}
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
}: {
  label: string;
  id: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  format?: (value: number) => string;
}) {
  // Slider isn't a labelable element — htmlFor can't reach it (WCAG 4.1.2),
  // so the label carries an id and the slider points back via aria-labelledby.
  return (
    <FieldRow label={label} labelId={`${id}-label`}>
      <Slider
        id={id}
        aria-labelledby={`${id}-label`}
        // Announce the same unit the readout shows ("40%", not a bare "40")
        getAriaValueText={(_formatted, v) => (format ? format(v) : String(v))}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        min={min}
        max={max}
        disabled={disabled}
        // Fill the row — a 7rem strip made every slider read as a dot on a hairline
        className="min-w-24 flex-1"
      />
      <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {format ? format(value) : value}
      </span>
    </FieldRow>
  );
}

/** Toggle row — switch right-aligned on the shared grid. */
export function SwitchRow({
  label,
  id,
  checked,
  onChange,
}: {
  label: string;
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FieldRow label={label} htmlFor={id}>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(v as boolean)} size="sm" />
    </FieldRow>
  );
}
