"use client";

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
