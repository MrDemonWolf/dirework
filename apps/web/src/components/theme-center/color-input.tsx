"use client";

// Theme Center color field: a native swatch picker paired with a hex text input.

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { FieldRow } from "./field-row";

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

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ");

  return (
    <FieldRow
      label={label}
      htmlFor={id}
      error={invalid ? `Not applied. Use a hex color like #1a2b3c (current: ${value})` : null}
      errorId={errorId}
      hint={hint}
      hintId={hintId}
    >
      <input
        type="color"
        // <input type="color"> only accepts #rrggbb, but the stored value may be any
        // color the server allowlist takes (#rgb, rgb(), keywords); show black then.
        value={FULL_HEX.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color picker`}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
      />
      <Input
        id={id}
        value={draft}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        className="h-9 w-24 font-mono md:h-8"
        placeholder="#000000"
      />
    </FieldRow>
  );
}
