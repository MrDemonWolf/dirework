"use client";

// Theme Center color field: a native swatch picker and a hex text input in one bordered field.

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { inputFrameClassName } from "@/components/ui/input";
import { FieldRow, fieldDescribedBy } from "./field-row";

const FULL_HEX = /^#[0-9a-fA-F]{6}$/;
const SHORT_HEX = /^#[0-9a-fA-F]{3}$/;

/** Expand #abc → #aabbcc so short hex commits as a full value on blur. */
function expandShortHex(v: string) {
  return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
}

/**
 * Hex color field. Only `#rrggbb` (or `#rgb`, expanded on blur) ever reaches
 * `onChange`; anything else stays a local draft flagged as not applied. Hex is a
 * subset of what the server's `cssColorSchema` allowlist accepts, so a value set here
 * always saves. `id` defaults to one derived from `label`, so labels must be unique
 * per page when `id` is omitted.
 */
export function ColorInput({
  label,
  value,
  onChange,
  id: idProp,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** One-line helper text shown under the row. */
  hint?: string;
}) {
  const id = idProp ?? `color-${label.toLowerCase().replace(/\s+/g, "-")}`;

  // Draft while typing — only full hex values propagate to the working state
  // so a half-typed "#0" never reaches the live preview. An invalid draft is
  // kept and flagged on blur rather than silently reverted, so the user can
  // see why it didn't take (WCAG 3.3.1).
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const handleTextChange = (v: string) => {
    setDraft(v);
    if (FULL_HEX.test(v)) {
      setInvalid(false);
      onChange(v);
    }
  };

  const handleBlur = () => {
    if (SHORT_HEX.test(draft)) {
      const expanded = expandShortHex(draft);
      setDraft(expanded);
      setInvalid(false);
      onChange(expanded);
    } else {
      setInvalid(!FULL_HEX.test(draft));
    }
  };

  return (
    <FieldRow
      label={label}
      id={id}
      error={invalid ? `Not applied. Use a hex color like #1a2b3c (current: ${value})` : null}
      hint={hint}
    >
      {/* One field, two inputs: the swatch fills the field's left square (44px tall on a
          touch screen) and the hex text sits beside it, so a color row is as wide as
          every other control. The wrapper wears the Input frame and its focus/invalid
          rings; the inputs inside are bare. */}
      <div
        className={cn(
          inputFrameClassName,
          "flex w-full items-stretch overflow-hidden transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-1 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        )}
      >
        <input
          type="color"
          // <input type="color"> only accepts #rrggbb, but the stored value may be any
          // color the server allowlist takes (#rgb, rgb(), keywords); show black then.
          value={FULL_HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
          className="h-auto w-9 shrink-0 cursor-pointer border-0 border-r border-muted-foreground/40 bg-transparent p-1 outline-none md:w-8 pointer-coarse:w-11 [&::-moz-color-swatch]:rounded-xs [&::-moz-color-swatch]:border-foreground/25 [&::-webkit-color-swatch]:rounded-xs [&::-webkit-color-swatch]:border-foreground/25 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          id={id}
          value={draft}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={invalid || undefined}
          aria-describedby={fieldDescribedBy(id, hint, invalid)}
          // Input's type sizes: 16px on phones (no iOS zoom on focus), 14px from md.
          className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-base outline-none placeholder:text-muted-foreground md:text-sm"
          placeholder="#000000"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </FieldRow>
  );
}
