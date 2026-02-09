"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ColorInput({
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
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="h-8 w-24 font-mono text-xs"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
