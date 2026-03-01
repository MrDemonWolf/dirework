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
          <Label htmlFor="task-style-display-show-done" className="text-xs text-muted-foreground">Show Done</Label>
          <Switch
            id="task-style-display-show-done"
            checked={styles.display.showDone}
            onCheckedChange={(v) => updateNested(["display", "showDone"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="task-style-display-show-count" className="text-xs text-muted-foreground">Show Count</Label>
          <Switch
            id="task-style-display-show-count"
            checked={styles.display.showCount}
            onCheckedChange={(v) => updateNested(["display", "showCount"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="task-style-display-checkboxes" className="text-xs text-muted-foreground">Checkboxes</Label>
          <Switch
            id="task-style-display-checkboxes"
            checked={styles.display.useCheckboxes}
            onCheckedChange={(v) => updateNested(["display", "useCheckboxes"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="task-style-display-cross-on-done" className="text-xs text-muted-foreground">Cross on Done</Label>
          <Switch
            id="task-style-display-cross-on-done"
            checked={styles.display.crossOnDone}
            onCheckedChange={(v) => updateNested(["display", "crossOnDone"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-display-max-lines" className="w-28 shrink-0 text-xs text-muted-foreground">Max Lines</Label>
          <Slider
            id="task-style-display-max-lines"
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
          <Label htmlFor="task-style-header-height" className="w-28 shrink-0 text-xs text-muted-foreground">Height</Label>
          <Input
            id="task-style-header-height"
            value={styles.header.height}
            onChange={(e) => updateNested(["header", "height"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Background"
          id="task-style-header-bg-color"
          value={styles.header.background.color}
          onChange={(v) => updateNested(["header", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-header-bg-opacity" className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            id="task-style-header-bg-opacity"
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
          id="task-style-header-border-color"
          value={styles.header.border.color}
          onChange={(v) => updateNested(["header", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-header-border-width" className="w-28 shrink-0 text-xs text-muted-foreground">Border Width</Label>
          <Input
            id="task-style-header-border-width"
            value={styles.header.border.width}
            onChange={(e) => updateNested(["header", "border", "width"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-header-border-radius" className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            id="task-style-header-border-radius"
            value={styles.header.border.radius}
            onChange={(e) => updateNested(["header", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-header-font-size" className="w-28 shrink-0 text-xs text-muted-foreground">Font Size</Label>
          <Input
            id="task-style-header-font-size"
            value={styles.header.fontSize}
            onChange={(e) => updateNested(["header", "fontSize"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Font Color"
          id="task-style-header-font-color"
          value={styles.header.fontColor}
          onChange={(v) => updateNested(["header", "fontColor"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-header-padding" className="w-28 shrink-0 text-xs text-muted-foreground">Padding</Label>
          <Input
            id="task-style-header-padding"
            value={styles.header.padding}
            onChange={(e) => updateNested(["header", "padding"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Body" defaultOpen={false}>
        <ColorInput
          label="Background"
          id="task-style-body-bg-color"
          value={styles.body.background.color}
          onChange={(v) => updateNested(["body", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-body-bg-opacity" className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            id="task-style-body-bg-opacity"
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
          id="task-style-body-border-color"
          value={styles.body.border.color}
          onChange={(v) => updateNested(["body", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-body-border-width" className="w-28 shrink-0 text-xs text-muted-foreground">Border Width</Label>
          <Input
            id="task-style-body-border-width"
            value={styles.body.border.width}
            onChange={(e) => updateNested(["body", "border", "width"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-body-border-radius" className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            id="task-style-body-border-radius"
            value={styles.body.border.radius}
            onChange={(e) => updateNested(["body", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-body-pad-vertical" className="w-28 shrink-0 text-xs text-muted-foreground">Pad Vertical</Label>
          <Input
            id="task-style-body-pad-vertical"
            value={styles.body.padding.vertical}
            onChange={(e) => updateNested(["body", "padding", "vertical"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-body-pad-horizontal" className="w-28 shrink-0 text-xs text-muted-foreground">Pad Horizontal</Label>
          <Input
            id="task-style-body-pad-horizontal"
            value={styles.body.padding.horizontal}
            onChange={(e) => updateNested(["body", "padding", "horizontal"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Task Item">
        <ColorInput
          label="Background"
          id="task-style-task-bg-color"
          value={styles.task.background.color}
          onChange={(v) => updateNested(["task", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-bg-opacity" className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            id="task-style-task-bg-opacity"
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
          id="task-style-task-border-color"
          value={styles.task.border.color}
          onChange={(v) => updateNested(["task", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-border-width" className="w-28 shrink-0 text-xs text-muted-foreground">Border Width</Label>
          <Input
            id="task-style-task-border-width"
            value={styles.task.border.width}
            onChange={(e) => updateNested(["task", "border", "width"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-border-radius" className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            id="task-style-task-border-radius"
            value={styles.task.border.radius}
            onChange={(e) => updateNested(["task", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-font-size" className="w-28 shrink-0 text-xs text-muted-foreground">Font Size</Label>
          <Input
            id="task-style-task-font-size"
            value={styles.task.fontSize}
            onChange={(e) => updateNested(["task", "fontSize"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Font Color"
          id="task-style-task-font-color"
          value={styles.task.fontColor}
          onChange={(v) => updateNested(["task", "fontColor"], v)}
        />
        <ColorInput
          label="Username Color"
          id="task-style-task-username-color"
          value={styles.task.usernameColor}
          onChange={(v) => updateNested(["task", "usernameColor"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-padding" className="w-28 shrink-0 text-xs text-muted-foreground">Padding</Label>
          <Input
            id="task-style-task-padding"
            value={styles.task.padding}
            onChange={(e) => updateNested(["task", "padding"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-margin-bottom" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Bottom</Label>
          <Input
            id="task-style-task-margin-bottom"
            value={styles.task.marginBottom}
            onChange={(e) => updateNested(["task", "marginBottom"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-task-max-width" className="w-28 shrink-0 text-xs text-muted-foreground">Max Width</Label>
          <Input
            id="task-style-task-max-width"
            value={styles.task.maxWidth}
            onChange={(e) => updateNested(["task", "maxWidth"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Done State" defaultOpen={false}>
        <ColorInput
          label="Background"
          id="task-style-done-bg-color"
          value={styles.taskDone.background.color}
          onChange={(v) => updateNested(["taskDone", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-done-bg-opacity" className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            id="task-style-done-bg-opacity"
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
          id="task-style-done-font-color"
          value={styles.taskDone.fontColor}
          onChange={(v) => updateNested(["taskDone", "fontColor"], v)}
        />
      </SectionGroup>

      <SectionGroup title="Checkbox" defaultOpen={false}>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-size" className="w-28 shrink-0 text-xs text-muted-foreground">Size</Label>
          <Input
            id="task-style-checkbox-size"
            value={styles.checkbox.size}
            onChange={(e) => updateNested(["checkbox", "size"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Background"
          id="task-style-checkbox-bg-color"
          value={styles.checkbox.background.color}
          onChange={(v) => updateNested(["checkbox", "background", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-bg-opacity" className="w-28 shrink-0 text-xs text-muted-foreground">BG Opacity</Label>
          <Slider
            id="task-style-checkbox-bg-opacity"
            value={[styles.checkbox.background.opacity * 100]}
            onValueChange={(v) => updateNested(["checkbox", "background", "opacity"], (Array.isArray(v) ? v[0] : v) / 100)}
            min={0}
            max={100}
            className="w-32"
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {Math.round(styles.checkbox.background.opacity * 100)}%
          </span>
        </div>
        <ColorInput
          label="Border Color"
          id="task-style-checkbox-border-color"
          value={styles.checkbox.border.color}
          onChange={(v) => updateNested(["checkbox", "border", "color"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-border-width" className="w-28 shrink-0 text-xs text-muted-foreground">Border Width</Label>
          <Input
            id="task-style-checkbox-border-width"
            value={styles.checkbox.border.width}
            onChange={(e) => updateNested(["checkbox", "border", "width"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-border-radius" className="w-28 shrink-0 text-xs text-muted-foreground">Border Radius</Label>
          <Input
            id="task-style-checkbox-border-radius"
            value={styles.checkbox.border.radius}
            onChange={(e) => updateNested(["checkbox", "border", "radius"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-tick-char" className="w-28 shrink-0 text-xs text-muted-foreground">Tick Character</Label>
          <Input
            id="task-style-checkbox-tick-char"
            value={styles.checkbox.tickChar}
            onChange={(e) => updateNested(["checkbox", "tickChar"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-tick-size" className="w-28 shrink-0 text-xs text-muted-foreground">Tick Size</Label>
          <Input
            id="task-style-checkbox-tick-size"
            value={styles.checkbox.tickSize}
            onChange={(e) => updateNested(["checkbox", "tickSize"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <ColorInput
          label="Tick Color"
          id="task-style-checkbox-tick-color"
          value={styles.checkbox.tickColor}
          onChange={(v) => updateNested(["checkbox", "tickColor"], v)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-margin-top" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Top</Label>
          <Input
            id="task-style-checkbox-margin-top"
            value={styles.checkbox.margin.top}
            onChange={(e) => updateNested(["checkbox", "margin", "top"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-margin-left" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Left</Label>
          <Input
            id="task-style-checkbox-margin-left"
            value={styles.checkbox.margin.left}
            onChange={(e) => updateNested(["checkbox", "margin", "left"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-checkbox-margin-right" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Right</Label>
          <Input
            id="task-style-checkbox-margin-right"
            value={styles.checkbox.margin.right}
            onChange={(e) => updateNested(["checkbox", "margin", "right"], e.target.value)}
            className="h-8 w-24 text-xs"
          />
        </div>
      </SectionGroup>

      {!styles.display.useCheckboxes && (
        <SectionGroup title="Bullet" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <Label htmlFor="task-style-bullet-char" className="w-28 shrink-0 text-xs text-muted-foreground">Character</Label>
            <Input
              id="task-style-bullet-char"
              value={styles.bullet.char}
              onChange={(e) => updateNested(["bullet", "char"], e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="task-style-bullet-size" className="w-28 shrink-0 text-xs text-muted-foreground">Size</Label>
            <Input
              id="task-style-bullet-size"
              value={styles.bullet.size}
              onChange={(e) => updateNested(["bullet", "size"], e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
          <ColorInput
            label="Color"
            id="task-style-bullet-color"
            value={styles.bullet.color}
            onChange={(v) => updateNested(["bullet", "color"], v)}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="task-style-bullet-margin-top" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Top</Label>
            <Input
              id="task-style-bullet-margin-top"
              value={styles.bullet.margin.top}
              onChange={(e) => updateNested(["bullet", "margin", "top"], e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="task-style-bullet-margin-left" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Left</Label>
            <Input
              id="task-style-bullet-margin-left"
              value={styles.bullet.margin.left}
              onChange={(e) => updateNested(["bullet", "margin", "left"], e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="task-style-bullet-margin-right" className="w-28 shrink-0 text-xs text-muted-foreground">Margin Right</Label>
            <Input
              id="task-style-bullet-margin-right"
              value={styles.bullet.margin.right}
              onChange={(e) => updateNested(["bullet", "margin", "right"], e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
        </SectionGroup>
      )}

      <SectionGroup title="Scroll" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <Label htmlFor="task-style-scroll-enabled" className="text-xs text-muted-foreground">Enabled</Label>
          <Switch
            id="task-style-scroll-enabled"
            checked={styles.scroll.enabled}
            onCheckedChange={(v) => updateNested(["scroll", "enabled"], v)}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-scroll-speed" className="w-28 shrink-0 text-xs text-muted-foreground">Speed (px/s)</Label>
          <Slider
            id="task-style-scroll-speed"
            value={[styles.scroll.pixelsPerSecond]}
            onValueChange={(v) => updateNested(["scroll", "pixelsPerSecond"], Array.isArray(v) ? v[0] : v)}
            min={0}
            max={200}
            className="w-32"
            disabled={!styles.scroll.enabled}
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {styles.scroll.pixelsPerSecond}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-style-scroll-loop-gap" className="w-28 shrink-0 text-xs text-muted-foreground">Loop Gap (px)</Label>
          <Slider
            id="task-style-scroll-loop-gap"
            value={[styles.scroll.gapBetweenLoops]}
            onValueChange={(v) => updateNested(["scroll", "gapBetweenLoops"], Array.isArray(v) ? v[0] : v)}
            min={0}
            max={300}
            className="w-32"
            disabled={!styles.scroll.enabled}
          />
          <span className="w-10 text-right text-xs text-muted-foreground">
            {styles.scroll.gapBetweenLoops}
          </span>
        </div>
      </SectionGroup>
    </div>
  );
}
