"use client";

// Theme Center font picker over the fixed, self-hosted overlay font list.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Self-hosted faces (public/fonts) — every option renders in its own family,
// both here and on the overlays, with no Google CDN request.
import { FONT_OPTIONS } from "@/lib/overlay-font-options";
import { FieldRow, fieldDescribedBy } from "./field-row";

/**
 * Font family dropdown limited to `FONT_OPTIONS`. Its id is derived from `label` (so
 * labels must be unique within a page) unless `id` is passed.
 */
export function FontSelect({
  label,
  value,
  onChange,
  id: idProp,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Overrides the label-derived id, for a label that repeats on the page. */
  id?: string;
  hint?: string;
}) {
  const id = idProp ?? `font-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <FieldRow label={label} id={id} hint={hint}>
      <Select
        value={value}
        onValueChange={(v) => {
          // The callback's value can be empty/null (no selection); never save an empty font.
          if (v) onChange(v);
        }}
      >
        <SelectTrigger
          id={id}
          aria-describedby={fieldDescribedBy(id, hint)}
          // The chosen face shown in itself, like the options below.
          className="w-full"
          style={{ fontFamily: `'${value}', sans-serif` }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((font) => (
            <SelectItem
              key={font}
              value={font}
              className="text-sm"
              style={{ fontFamily: `'${font}', sans-serif` }}
            >
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  );
}
