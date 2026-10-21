"use client";

// Shared Theme Center field controls used by the section editor (style-sections-editor.tsx).

import { SliderRow } from "./field-row";

/** 0–1 opacity edited as a 0–100% slider — the one place the ×100/÷100 lives. */
export function OpacitySliderRow({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <SliderRow
      label={label}
      id={id}
      value={Math.round(value * 100)}
      onChange={(v) => onChange(v / 100)}
      min={0}
      max={100}
      format={(v) => `${v}%`}
    />
  );
}
