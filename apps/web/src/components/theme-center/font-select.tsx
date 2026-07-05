"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "./field-row";

const fontOptions = [
  "Montserrat",
  "Roboto",
  "Inter",
  "Poppins",
  "Open Sans",
  "Lato",
  "Nunito",
  "Oswald",
  "Raleway",
  "Source Sans 3",
  "Ubuntu",
  "Merriweather",
  "Playfair Display",
  "Space Grotesk",
  "DM Sans",
  "Lexend",
  "Share Tech Mono",
  "Fira Code",
  "JetBrains Mono",
  "Fredoka One",
];

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
      <Select value={value} onValueChange={(v) => { if (v) onChange(v); }}>
        <SelectTrigger id={id} className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fontOptions.map((font) => (
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
