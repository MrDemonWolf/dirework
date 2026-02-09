"use client";

import type { TimerStylesConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ColorInput } from "./color-input";
import { FontSelect } from "./font-select";
import { SectionGroup } from "./section-group";

export function TimerStyleEditor({
  styles,
  onChange,
}: {
  styles: TimerStylesConfig;
  onChange: (styles: TimerStylesConfig) => void;
}) {
  function update<K extends keyof TimerStylesConfig>(
    section: K,
    patch: Partial<TimerStylesConfig[K]>,
  ) {
    onChange({
      ...styles,
      [section]: { ...styles[section], ...patch },
    });
  }

  return (
    <div className="space-y-1">
      <SectionGroup title="Dimensions">
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Width</Label>
          <Input
            value={styles.dimensions.width}
            onChange={(e) => update("dimensions", { width: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Height</Label>
          <Input
            value={styles.dimensions.height}
            onChange={(e) => update("dimensions", { height: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Background">
        <ColorInput
          label="Color"
          value={styles.background.color}
          onChange={(v) => update("background", { color: v })}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Opacity</Label>
          <Slider
            value={[styles.background.opacity * 100]}
            onValueChange={(v: number[]) => update("background", { opacity: v[0] / 100 })}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.background.opacity * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            value={styles.background.borderRadius}
            onChange={(e) => update("background", { borderRadius: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Text">
        <ColorInput
          label="Color"
          value={styles.text.color}
          onChange={(v) => update("text", { color: v })}
        />
        <ColorInput
          label="Outline Color"
          value={styles.text.outlineColor}
          onChange={(v) => update("text", { outlineColor: v })}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Outline Size</Label>
          <Input
            value={styles.text.outlineSize}
            onChange={(e) => update("text", { outlineSize: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
        <FontSelect
          label="Font Family"
          value={styles.text.fontFamily}
          onChange={(v) => update("text", { fontFamily: v })}
        />
      </SectionGroup>

      <SectionGroup title="Font Sizes">
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Label</Label>
          <Input
            value={styles.fontSizes.label}
            onChange={(e) => update("fontSizes", { label: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Time</Label>
          <Input
            value={styles.fontSizes.time}
            onChange={(e) => update("fontSizes", { time: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Cycle</Label>
          <Input
            value={styles.fontSizes.cycle}
            onChange={(e) => update("fontSizes", { cycle: e.target.value })}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>
    </div>
  );
}
