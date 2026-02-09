"use client";

import type { TaskStylesConfig } from "@/lib/config-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ColorInput } from "./color-input";
import { FontSelect } from "./font-select";
import { SectionGroup } from "./section-group";

export function TaskStyleEditor({
  styles,
  onChange,
}: {
  styles: TaskStylesConfig;
  onChange: (styles: TaskStylesConfig) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateNested(path: string[], value: any) {
    const updated = JSON.parse(JSON.stringify(styles)) as Record<string, unknown>;
    let current = updated as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;
    onChange(updated as unknown as TaskStylesConfig);
  }

  return (
    <div className="space-y-1">
      <SectionGroup title="Display">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Show Done</Label>
          <Switch
            checked={styles.display.showDone}
            onCheckedChange={(v) => updateNested(["display", "showDone"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Show Count</Label>
          <Switch
            checked={styles.display.showCount}
            onCheckedChange={(v) => updateNested(["display", "showCount"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Checkboxes</Label>
          <Switch
            checked={styles.display.useCheckboxes}
            onCheckedChange={(v) => updateNested(["display", "useCheckboxes"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Cross on Done</Label>
          <Switch
            checked={styles.display.crossOnDone}
            onCheckedChange={(v) => updateNested(["display", "crossOnDone"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Max Lines</Label>
          <Slider
            value={[styles.display.numberOfLines]}
            onValueChange={(v) => updateNested(["display", "numberOfLines"], Array.isArray(v) ? v[0] : v)}
            min={1}
            max={5}
            className="w-32"
          />
          <span className="w-6 text-right text-xs text-muted-foreground">
            {styles.display.numberOfLines}
          </span>
        </div>
      </SectionGroup>

      <SectionGroup title="Fonts">
        <FontSelect
          label="Header Font"
          value={styles.fonts.header}
          onChange={(v) => updateNested(["fonts", "header"], v)}
        />
        <FontSelect
          label="Body Font"
          value={styles.fonts.body}
          onChange={(v) => updateNested(["fonts", "body"], v)}
        />
      </SectionGroup>

      <SectionGroup title="Header">
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Height</Label>
          <Input
            value={styles.header.height}
            onChange={(e) => updateNested(["header", "height"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Background"
          value={styles.header.background.color}
          onChange={(v) => updateNested(["header", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            value={[styles.header.background.opacity * 100]}
            onValueChange={(v) => updateNested(["header", "background", "opacity"], (Array.isArray(v) ? v[0] : v) / 100)}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.header.background.opacity * 100)}%
          </span>
        </div>
        <ColorInput
          label="Border Color"
          value={styles.header.border.color}
          onChange={(v) => updateNested(["header", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Border Width</Label>
          <Input
            value={styles.header.border.width}
            onChange={(e) => updateNested(["header", "border", "width"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            value={styles.header.border.radius}
            onChange={(e) => updateNested(["header", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Font Size</Label>
          <Input
            value={styles.header.fontSize}
            onChange={(e) => updateNested(["header", "fontSize"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Font Color"
          value={styles.header.fontColor}
          onChange={(v) => updateNested(["header", "fontColor"], v)}
        />
      </SectionGroup>

      <SectionGroup title="Body" defaultOpen={false}>
        <ColorInput
          label="Background"
          value={styles.body.background.color}
          onChange={(v) => updateNested(["body", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            value={[styles.body.background.opacity * 100]}
            onValueChange={(v) => updateNested(["body", "background", "opacity"], (Array.isArray(v) ? v[0] : v) / 100)}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.body.background.opacity * 100)}%
          </span>
        </div>
        <ColorInput
          label="Border Color"
          value={styles.body.border.color}
          onChange={(v) => updateNested(["body", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Border Width</Label>
          <Input
            value={styles.body.border.width}
            onChange={(e) => updateNested(["body", "border", "width"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            value={styles.body.border.radius}
            onChange={(e) => updateNested(["body", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Task Item">
        <ColorInput
          label="Background"
          value={styles.task.background.color}
          onChange={(v) => updateNested(["task", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            value={[styles.task.background.opacity * 100]}
            onValueChange={(v) => updateNested(["task", "background", "opacity"], (Array.isArray(v) ? v[0] : v) / 100)}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.task.background.opacity * 100)}%
          </span>
        </div>
        <ColorInput
          label="Border Color"
          value={styles.task.border.color}
          onChange={(v) => updateNested(["task", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            value={styles.task.border.radius}
            onChange={(e) => updateNested(["task", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Font Size</Label>
          <Input
            value={styles.task.fontSize}
            onChange={(e) => updateNested(["task", "fontSize"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Font Color"
          value={styles.task.fontColor}
          onChange={(v) => updateNested(["task", "fontColor"], v)}
        />
        <ColorInput
          label="Username Color"
          value={styles.task.usernameColor}
          onChange={(v) => updateNested(["task", "usernameColor"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Padding</Label>
          <Input
            value={styles.task.padding}
            onChange={(e) => updateNested(["task", "padding"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Margin Bottom</Label>
          <Input
            value={styles.task.marginBottom}
            onChange={(e) => updateNested(["task", "marginBottom"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Done State" defaultOpen={false}>
        <ColorInput
          label="Background"
          value={styles.taskDone.background.color}
          onChange={(v) => updateNested(["taskDone", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            value={[styles.taskDone.background.opacity * 100]}
            onValueChange={(v) => updateNested(["taskDone", "background", "opacity"], (Array.isArray(v) ? v[0] : v) / 100)}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.taskDone.background.opacity * 100)}%
          </span>
        </div>
        <ColorInput
          label="Font Color"
          value={styles.taskDone.fontColor}
          onChange={(v) => updateNested(["taskDone", "fontColor"], v)}
        />
      </SectionGroup>

      <SectionGroup title="Checkbox" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Size</Label>
          <Input
            value={styles.checkbox.size}
            onChange={(e) => updateNested(["checkbox", "size"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Border Color"
          value={styles.checkbox.border.color}
          onChange={(v) => updateNested(["checkbox", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Tick Character</Label>
          <Input
            value={styles.checkbox.tickChar}
            onChange={(e) => updateNested(["checkbox", "tickChar"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Tick Color"
          value={styles.checkbox.tickColor}
          onChange={(v) => updateNested(["checkbox", "tickColor"], v)}
        />
      </SectionGroup>

      <SectionGroup title="Scroll" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Speed (px/s)</Label>
          <Slider
            value={[styles.scroll.pixelsPerSecond]}
            onValueChange={(v) => updateNested(["scroll", "pixelsPerSecond"], Array.isArray(v) ? v[0] : v)}
            min={0}
            max={200}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {styles.scroll.pixelsPerSecond}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="w-28 shrink-0 text-xs text-muted-foreground">Loop Gap (px)</Label>
          <Slider
            value={[styles.scroll.gapBetweenLoops]}
            onValueChange={(v) => updateNested(["scroll", "gapBetweenLoops"], Array.isArray(v) ? v[0] : v)}
            min={0}
            max={300}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {styles.scroll.gapBetweenLoops}
          </span>
        </div>
      </SectionGroup>
    </div>
  );
}
