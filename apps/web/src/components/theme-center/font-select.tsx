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
import { FieldRow } from "./field-row";

/**
 * Font family dropdown limited to `FONT_OPTIONS`. Its id is derived from `label`, so
 * labels must be unique within a page.
 */
export function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `font-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <FieldRow label={label} htmlFor={id}>
      <Select
        value={value}
        onValueChange={(v) => {
          // The callback's value can be empty/null (no selection); never save an empty font.
          if (v) onChange(v);
        }}
      >
        <SelectTrigger id={id} className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((font) => (
            <SelectItem
              key={font}
              value={font}
              className="text-xs"
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
