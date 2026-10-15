"use client";

import { glyphSchema } from "@dirework/api/config-shared";

import type { TaskStylesConfig } from "@/lib/config-types";
import { ColorInput } from "./color-input";
import { SliderRow, SwitchRow, TextFieldRow } from "./field-row";
import { FontSelect } from "./font-select";
import { SectionGroup } from "./section-group";
import { BackgroundFields, BorderFields, MarginFields } from "./style-field-groups";

export function TaskStyleEditor({
  styles,
  onChange,
}: {
  styles: TaskStylesConfig;
  onChange: (styles: TaskStylesConfig) => void;
}) {
  function update<K extends keyof TaskStylesConfig>(
    section: K,
    patch: Partial<TaskStylesConfig[K]>,
  ) {
    onChange({
      ...styles,
      [section]: { ...styles[section], ...patch },
    });
  }

  return (
    <div className="space-y-3">
      <SectionGroup title="Display">
        <SwitchRow
          label="Show done tasks"
          id="task-style-display-show-done"
          checked={styles.display.showDone}
          onChange={(v) => update("display", { showDone: v })}
        />
        <SwitchRow
          label="Show task count"
          id="task-style-display-show-count"
          checked={styles.display.showCount}
          onChange={(v) => update("display", { showCount: v })}
        />
        <SwitchRow
          label="Checkboxes"
          id="task-style-display-checkboxes"
          checked={styles.display.useCheckboxes}
          onChange={(v) => update("display", { useCheckboxes: v })}
        />
        {styles.display.useCheckboxes && (
          <p className="text-xs text-muted-foreground">
            Bullet options appear when checkboxes are off.
          </p>
        )}
        <SwitchRow
          label="Cross out done tasks"
          id="task-style-display-cross-on-done"
          checked={styles.display.crossOnDone}
          onChange={(v) => update("display", { crossOnDone: v })}
        />
        <SliderRow
          label="Lines per task"
          id="task-style-display-max-lines"
          value={styles.display.numberOfLines}
          onChange={(v) => update("display", { numberOfLines: v })}
          min={1}
          max={5}
        />
      </SectionGroup>

      <SectionGroup title="Fonts">
        <FontSelect
          label="Header font"
          value={styles.fonts.header}
          onChange={(v) => update("fonts", { header: v })}
        />
        <FontSelect
          label="Body font"
          value={styles.fonts.body}
          onChange={(v) => update("fonts", { body: v })}
        />
      </SectionGroup>

      <SectionGroup title="Header">
        <TextFieldRow
          label="Height"
          id="task-style-header-height"
          value={styles.header.height}
          onChange={(v) => update("header", { height: v })}
          unit="px"
          placeholder="60px"
        />
        <BackgroundFields
          idPrefix="task-style-header"
          value={styles.header.background}
          onChange={(background) => update("header", { background })}
        />
        <BorderFields
          idPrefix="task-style-header"
          value={styles.header.border}
          onChange={(border) => update("header", { border })}
        />
        <TextFieldRow
          label="Font size"
          id="task-style-header-font-size"
          value={styles.header.fontSize}
          onChange={(v) => update("header", { fontSize: v })}
          unit="px"
          placeholder="24px"
        />
        <ColorInput
          label="Font color"
          id="task-style-header-font-color"
          value={styles.header.fontColor}
          onChange={(v) => update("header", { fontColor: v })}
        />
        <TextFieldRow
          label="Padding"
          id="task-style-header-padding"
          value={styles.header.padding}
          onChange={(v) => update("header", { padding: v })}
          placeholder="10px"
        />
      </SectionGroup>

      <SectionGroup title="Body" defaultOpen={false}>
        <BackgroundFields
          idPrefix="task-style-body"
          value={styles.body.background}
          onChange={(background) => update("body", { background })}
        />
        <BorderFields
          idPrefix="task-style-body"
          value={styles.body.border}
          onChange={(border) => update("body", { border })}
        />
        <TextFieldRow
          label="Vertical padding"
          id="task-style-body-pad-vertical"
          value={styles.body.padding.vertical}
          onChange={(v) => update("body", { padding: { ...styles.body.padding, vertical: v } })}
          unit="px"
          placeholder="10px"
        />
        <TextFieldRow
          label="Horizontal padding"
          id="task-style-body-pad-horizontal"
          value={styles.body.padding.horizontal}
          onChange={(v) => update("body", { padding: { ...styles.body.padding, horizontal: v } })}
          unit="px"
          placeholder="10px"
        />
      </SectionGroup>

      <SectionGroup title="Task item">
        <BackgroundFields
          idPrefix="task-style-task"
          value={styles.task.background}
          onChange={(background) => update("task", { background })}
        />
        <BorderFields
          idPrefix="task-style-task"
          value={styles.task.border}
          onChange={(border) => update("task", { border })}
        />
        <TextFieldRow
          label="Font size"
          id="task-style-task-font-size"
          value={styles.task.fontSize}
          onChange={(v) => update("task", { fontSize: v })}
          unit="px"
          placeholder="16px"
        />
        <ColorInput
          label="Font color"
          id="task-style-task-font-color"
          value={styles.task.fontColor}
          onChange={(v) => update("task", { fontColor: v })}
        />
        <ColorInput
          label="Username color"
          id="task-style-task-username-color"
          value={styles.task.usernameColor}
          onChange={(v) => update("task", { usernameColor: v })}
        />
        <TextFieldRow
          label="Padding"
          id="task-style-task-padding"
          value={styles.task.padding}
          onChange={(v) => update("task", { padding: v })}
          placeholder="8px"
        />
        <TextFieldRow
          label="Margin bottom"
          id="task-style-task-margin-bottom"
          value={styles.task.marginBottom}
          onChange={(v) => update("task", { marginBottom: v })}
          unit="px"
          placeholder="8px"
        />
        <TextFieldRow
          label="Max width"
          id="task-style-task-max-width"
          value={styles.task.maxWidth}
          onChange={(v) => update("task", { maxWidth: v })}
          unit="px"
          placeholder="300px"
        />
      </SectionGroup>

      <SectionGroup title="Done tasks" defaultOpen={false}>
        <BackgroundFields
          idPrefix="task-style-done"
          value={styles.taskDone.background}
          onChange={(background) => update("taskDone", { background })}
        />
        <ColorInput
          label="Font color"
          id="task-style-done-font-color"
          value={styles.taskDone.fontColor}
          onChange={(v) => update("taskDone", { fontColor: v })}
        />
      </SectionGroup>

      <SectionGroup title="Checkbox" defaultOpen={false}>
        <TextFieldRow
          label="Size"
          id="task-style-checkbox-size"
          value={styles.checkbox.size}
          onChange={(v) => update("checkbox", { size: v })}
          unit="px"
          placeholder="20px"
        />
        <BackgroundFields
          idPrefix="task-style-checkbox"
          value={styles.checkbox.background}
          onChange={(background) => update("checkbox", { background })}
        />
        <BorderFields
          idPrefix="task-style-checkbox"
          value={styles.checkbox.border}
          onChange={(border) => update("checkbox", { border })}
          radiusPlaceholder="4px"
        />
        <TextFieldRow
          label="Tick character"
          id="task-style-checkbox-tick-char"
          value={styles.checkbox.tickChar}
          onChange={(v) => update("checkbox", { tickChar: v })}
          schema={glyphSchema}
          invalidHint="Use 1 to 8 characters"
        />
        <TextFieldRow
          label="Tick size"
          id="task-style-checkbox-tick-size"
          value={styles.checkbox.tickSize}
          onChange={(v) => update("checkbox", { tickSize: v })}
          unit="px"
          placeholder="14px"
        />
        <ColorInput
          label="Tick color"
          id="task-style-checkbox-tick-color"
          value={styles.checkbox.tickColor}
          onChange={(v) => update("checkbox", { tickColor: v })}
        />
        <MarginFields
          idPrefix="task-style-checkbox"
          value={styles.checkbox.margin}
          onChange={(margin) => update("checkbox", { margin })}
        />
      </SectionGroup>

      {!styles.display.useCheckboxes && (
        <SectionGroup title="Bullet" defaultOpen={false}>
          <TextFieldRow
            label="Character"
            id="task-style-bullet-char"
            value={styles.bullet.char}
            onChange={(v) => update("bullet", { char: v })}
            schema={glyphSchema}
            invalidHint="Use 1 to 8 characters"
          />
          <TextFieldRow
            label="Size"
            id="task-style-bullet-size"
            value={styles.bullet.size}
            onChange={(v) => update("bullet", { size: v })}
            unit="px"
            placeholder="16px"
          />
          <ColorInput
            label="Color"
            id="task-style-bullet-color"
            value={styles.bullet.color}
            onChange={(v) => update("bullet", { color: v })}
          />
          <MarginFields
            idPrefix="task-style-bullet"
            value={styles.bullet.margin}
            onChange={(margin) => update("bullet", { margin })}
          />
        </SectionGroup>
      )}

      <SectionGroup title="Scroll" defaultOpen={false}>
        <SwitchRow
          label="Enabled"
          id="task-style-scroll-enabled"
          checked={styles.scroll.enabled}
          onChange={(v) => update("scroll", { enabled: v })}
        />
        <SliderRow
          label="Speed (px/s)"
          id="task-style-scroll-speed"
          value={styles.scroll.pixelsPerSecond}
          onChange={(v) => update("scroll", { pixelsPerSecond: v })}
          min={1}
          max={200}
          disabled={!styles.scroll.enabled}
        />
        <SliderRow
          label="Loop gap"
          id="task-style-scroll-loop-gap"
          value={styles.scroll.gapBetweenLoops}
          onChange={(v) => update("scroll", { gapBetweenLoops: v })}
          min={0}
          max={300}
          disabled={!styles.scroll.enabled}
          format={(v) => `${v}px`}
        />
      </SectionGroup>
    </div>
  );
}
