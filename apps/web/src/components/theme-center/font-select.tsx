"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  return (
    <div className="flex items-center gap-2">
      <Label className="w-28 shrink-0 text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => { if (v) onChange(v); }}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fontOptions.map((font) => (
            <SelectItem key={font} value={font} className="text-xs">
              {font}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
