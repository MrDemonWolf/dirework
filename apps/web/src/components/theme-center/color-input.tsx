"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { FieldRow } from "./field-row";

const FULL_HEX = /^#[0-9a-fA-F]{6}$/;
const SHORT_HEX = /^#[0-9a-fA-F]{3}$/;

/** Expand #abc → #aabbcc so short hex commits as a full value on blur. */
function expandShortHex(v: string) {
  return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
}

export function ColorInput({
  label,
  value,
  onChange,
  id: idProp,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const id = idProp ?? `color-${label.toLowerCase().replace(/\s+/g, "-")}`;

  // Draft while typing — only full hex values propagate to the working state
  // so a half-typed "#0" never reaches the live preview.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleTextChange = (v: string) => {
    setDraft(v);
    if (FULL_HEX.test(v)) onChange(v);
  };

  const handleBlur = () => {
    if (SHORT_HEX.test(draft)) {
      const expanded = expandShortHex(draft);
      setDraft(expanded);
      onChange(expanded);
    } else if (!FULL_HEX.test(draft)) {
      setDraft(value);
    }
  };

  return (
    <FieldRow label={label} htmlFor={id}>
      <input
        type="color"
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
        className="h-8 w-24 font-mono"
        placeholder="#000000"
      />
    </FieldRow>
  );
}
