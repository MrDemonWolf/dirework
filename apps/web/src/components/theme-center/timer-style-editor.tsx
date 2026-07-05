"use client";

import type { TimerStylesConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
          <Label htmlFor="timer-style-dimensions-width" className="w-28 shrink-0 text-xs text-muted-foreground">Width</Label>
          <Input
            id="timer-style-dimensions-width"
            value={styles.dimensions.width}
            onChange={(e) => update("dimensions", { width: e.target.value })}
            className="h-8 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="timer-style-dimensions-height" className="w-28 shrink-0 text-xs text-muted-foreground">Height</Label>
          <Input
            id="timer-style-dimensions-height"
            value={styles.dimensions.height}
            onChange={(e) => update("dimensions", { height: e.target.value })}
            className="h-8 w-24"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Background">
        <ColorInput
          label="Color"
          id="timer-style-bg-color"
          value={styles.background.color}
          onChange={(v) => update("background", { color: v })}
        />
        <div className="flex items-center gap-2">
          <Label id="timer-style-bg-opacity-label" className="w-28 shrink-0 text-xs text-muted-foreground">Opacity</Label>
          <Slider
            aria-labelledby="timer-style-bg-opacity-label"
            value={[styles.background.opacity * 100]}
            onValueChange={(v) => update("background", { opacity: (Array.isArray(v) ? v[0] : v) / 100 })}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.background.opacity * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="timer-style-bg-border-radius" className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            id="timer-style-bg-border-radius"
            value={styles.background.borderRadius}
            onChange={(e) => update("background", { borderRadius: e.target.value })}
            className="h-8 w-24"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Progress Ring">
        <div className="flex items-center justify-between">
          <Label htmlFor="timer-style-ring-enabled" className="text-xs text-muted-foreground">Enabled</Label>
          <Switch
            id="timer-style-ring-enabled"
            checked={styles.ring.enabled}
            onCheckedChange={(v) => update("ring", { enabled: v as boolean })}
            size="sm"
          />
        </div>
        <ColorInput
          label="Fill Color"
          id="timer-style-ring-fill-color"
          value={styles.ring.fillColor}
          onChange={(v) => update("ring", { fillColor: v })}
        />
        <div className="flex items-center gap-2">
          <Label id="timer-style-ring-fill-opacity-label" className="w-28 shrink-0 text-xs text-muted-foreground">Fill Opacity</Label>
          <Slider
            aria-labelledby="timer-style-ring-fill-opacity-label"
            value={[styles.ring.fillOpacity * 100]}
            onValueChange={(v) => update("ring", { fillOpacity: (Array.isArray(v) ? v[0] : v) / 100 })}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.ring.fillOpacity * 100)}%
          </span>
        </div>
        <ColorInput
          label="Track Color"
          id="timer-style-ring-track-color"
          value={styles.ring.trackColor}
          onChange={(v) => update("ring", { trackColor: v })}
        />
        <div className="flex items-center gap-2">
          <Label id="timer-style-ring-track-opacity-label" className="w-28 shrink-0 text-xs text-muted-foreground">Track Opacity</Label>
          <Slider
            aria-labelledby="timer-style-ring-track-opacity-label"
            value={[styles.ring.trackOpacity * 100]}
            onValueChange={(v) => update("ring", { trackOpacity: (Array.isArray(v) ? v[0] : v) / 100 })}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.ring.trackOpacity * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label id="timer-style-ring-width-label" className="w-28 shrink-0 text-xs text-muted-foreground">Width</Label>
          <Slider
            aria-labelledby="timer-style-ring-width-label"
            value={[styles.ring.width]}
            onValueChange={(v) => update("ring", { width: Array.isArray(v) ? v[0] : v })}
            min={2}
            max={20}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {styles.ring.width}px
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label id="timer-style-ring-gap-label" className="w-28 shrink-0 text-xs text-muted-foreground">Gap</Label>
          <Slider
            aria-labelledby="timer-style-ring-gap-label"
            value={[styles.ring.gap]}
            onValueChange={(v) => update("ring", { gap: Array.isArray(v) ? v[0] : v })}
            min={0}
            max={20}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {styles.ring.gap}px
          </span>
        </div>
      </SectionGroup>

      <SectionGroup title="Text">
        <ColorInput
          label="Color"
          id="timer-style-text-color"
          value={styles.text.color}
          onChange={(v) => update("text", { color: v })}
        />
        <ColorInput
          label="Outline Color"
          id="timer-style-text-outline-color"
          value={styles.text.outlineColor}
          onChange={(v) => update("text", { outlineColor: v })}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="timer-style-text-outline-size" className="w-28 shrink-0 text-xs text-muted-foreground">Outline Size</Label>
          <Input
            id="timer-style-text-outline-size"
            value={styles.text.outlineSize}
            onChange={(e) => update("text", { outlineSize: e.target.value })}
            className="h-8 w-24"
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
          <Label htmlFor="timer-style-font-label" className="w-28 shrink-0 text-xs text-muted-foreground">Label</Label>
          <Input
            id="timer-style-font-label"
            value={styles.fontSizes.label}
            onChange={(e) => update("fontSizes", { label: e.target.value })}
            className="h-8 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="timer-style-font-time" className="w-28 shrink-0 text-xs text-muted-foreground">Time</Label>
          <Input
            id="timer-style-font-time"
            value={styles.fontSizes.time}
            onChange={(e) => update("fontSizes", { time: e.target.value })}
            className="h-8 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="timer-style-font-cycle" className="w-28 shrink-0 text-xs text-muted-foreground">Cycle</Label>
          <Input
            id="timer-style-font-cycle"
            value={styles.fontSizes.cycle}
            onChange={(e) => update("fontSizes", { cycle: e.target.value })}
            className="h-8 w-24"
          />
        </div>
      </SectionGroup>
    </div>
  );
}
