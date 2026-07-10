"use client";

import type { TaskStylesConfig } from "@/lib/config-types";
import { ColorInput } from "./color-input";
import { SliderRow, SwitchRow, TextFieldRow } from "./field-row";
import { FontSelect } from "./font-select";
import { SectionGroup } from "./section-group";

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
        <ColorInput
          label="Background"
          id="task-style-header-bg-color"
          value={styles.header.background.color}
          onChange={(v) =>
            update("header", { background: { ...styles.header.background, color: v } })
          }
        />
        <SliderRow
          label="Background opacity"
          id="task-style-header-bg-opacity"
          value={Math.round(styles.header.background.opacity * 100)}
          onChange={(v) =>
            update("header", { background: { ...styles.header.background, opacity: v / 100 } })
          }
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <ColorInput
          label="Border color"
          id="task-style-header-border-color"
          value={styles.header.border.color}
          onChange={(v) => update("header", { border: { ...styles.header.border, color: v } })}
        />
        <TextFieldRow
          label="Border width"
          id="task-style-header-border-width"
          value={styles.header.border.width}
          onChange={(v) => update("header", { border: { ...styles.header.border, width: v } })}
          unit="px"
          placeholder="2px"
        />
        <TextFieldRow
          label="Border radius"
          id="task-style-header-border-radius"
          value={styles.header.border.radius}
          onChange={(v) => update("header", { border: { ...styles.header.border, radius: v } })}
          placeholder="8px"
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
        <ColorInput
          label="Background"
          id="task-style-body-bg-color"
          value={styles.body.background.color}
          onChange={(v) =>
            update("body", { background: { ...styles.body.background, color: v } })
          }
        />
        <SliderRow
          label="Background opacity"
          id="task-style-body-bg-opacity"
          value={Math.round(styles.body.background.opacity * 100)}
          onChange={(v) =>
            update("body", { background: { ...styles.body.background, opacity: v / 100 } })
          }
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <ColorInput
          label="Border color"
          id="task-style-body-border-color"
          value={styles.body.border.color}
          onChange={(v) => update("body", { border: { ...styles.body.border, color: v } })}
        />
        <TextFieldRow
          label="Border width"
          id="task-style-body-border-width"
          value={styles.body.border.width}
          onChange={(v) => update("body", { border: { ...styles.body.border, width: v } })}
          unit="px"
          placeholder="2px"
        />
        <TextFieldRow
          label="Border radius"
          id="task-style-body-border-radius"
          value={styles.body.border.radius}
          onChange={(v) => update("body", { border: { ...styles.body.border, radius: v } })}
          placeholder="8px"
        />
        <TextFieldRow
          label="Vertical padding"
          id="task-style-body-pad-vertical"
          value={styles.body.padding.vertical}
          onChange={(v) =>
            update("body", { padding: { ...styles.body.padding, vertical: v } })
          }
          unit="px"
          placeholder="10px"
        />
        <TextFieldRow
          label="Horizontal padding"
          id="task-style-body-pad-horizontal"
          value={styles.body.padding.horizontal}
          onChange={(v) =>
            update("body", { padding: { ...styles.body.padding, horizontal: v } })
          }
          unit="px"
          placeholder="10px"
        />
      </SectionGroup>

      <SectionGroup title="Task item">
        <ColorInput
          label="Background"
          id="task-style-task-bg-color"
          value={styles.task.background.color}
          onChange={(v) =>
            update("task", { background: { ...styles.task.background, color: v } })
          }
        />
        <SliderRow
          label="Background opacity"
          id="task-style-task-bg-opacity"
          value={Math.round(styles.task.background.opacity * 100)}
          onChange={(v) =>
            update("task", { background: { ...styles.task.background, opacity: v / 100 } })
          }
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <ColorInput
          label="Border color"
          id="task-style-task-border-color"
          value={styles.task.border.color}
          onChange={(v) => update("task", { border: { ...styles.task.border, color: v } })}
        />
        <TextFieldRow
          label="Border width"
          id="task-style-task-border-width"
          value={styles.task.border.width}
          onChange={(v) => update("task", { border: { ...styles.task.border, width: v } })}
          unit="px"
          placeholder="2px"
        />
        <TextFieldRow
          label="Border radius"
          id="task-style-task-border-radius"
          value={styles.task.border.radius}
          onChange={(v) => update("task", { border: { ...styles.task.border, radius: v } })}
          placeholder="8px"
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
        <ColorInput
          label="Background"
          id="task-style-done-bg-color"
          value={styles.taskDone.background.color}
          onChange={(v) =>
            update("taskDone", { background: { ...styles.taskDone.background, color: v } })
          }
        />
        <SliderRow
          label="Background opacity"
          id="task-style-done-bg-opacity"
          value={Math.round(styles.taskDone.background.opacity * 100)}
          onChange={(v) =>
            update("taskDone", { background: { ...styles.taskDone.background, opacity: v / 100 } })
          }
          min={0}
          max={100}
          format={(v) => `${v}%`}
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
        <ColorInput
          label="Background"
          id="task-style-checkbox-bg-color"
          value={styles.checkbox.background.color}
          onChange={(v) =>
            update("checkbox", { background: { ...styles.checkbox.background, color: v } })
          }
        />
        <SliderRow
          label="Background opacity"
          id="task-style-checkbox-bg-opacity"
          value={Math.round(styles.checkbox.background.opacity * 100)}
          onChange={(v) =>
            update("checkbox", { background: { ...styles.checkbox.background, opacity: v / 100 } })
          }
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <ColorInput
          label="Border color"
          id="task-style-checkbox-border-color"
          value={styles.checkbox.border.color}
          onChange={(v) =>
            update("checkbox", { border: { ...styles.checkbox.border, color: v } })
          }
        />
        <TextFieldRow
          label="Border width"
          id="task-style-checkbox-border-width"
          value={styles.checkbox.border.width}
          onChange={(v) =>
            update("checkbox", { border: { ...styles.checkbox.border, width: v } })
          }
          unit="px"
          placeholder="2px"
        />
        <TextFieldRow
          label="Border radius"
          id="task-style-checkbox-border-radius"
          value={styles.checkbox.border.radius}
          onChange={(v) =>
            update("checkbox", { border: { ...styles.checkbox.border, radius: v } })
          }
          placeholder="4px"
        />
        <TextFieldRow
          label="Tick character"
          id="task-style-checkbox-tick-char"
          value={styles.checkbox.tickChar}
          onChange={(v) => update("checkbox", { tickChar: v })}
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
        <TextFieldRow
          label="Margin top"
          id="task-style-checkbox-margin-top"
          value={styles.checkbox.margin.top}
          onChange={(v) =>
            update("checkbox", { margin: { ...styles.checkbox.margin, top: v } })
          }
          unit="px"
          placeholder="2px"
        />
        <TextFieldRow
          label="Margin left"
          id="task-style-checkbox-margin-left"
          value={styles.checkbox.margin.left}
          onChange={(v) =>
            update("checkbox", { margin: { ...styles.checkbox.margin, left: v } })
          }
          unit="px"
          placeholder="0px"
        />
        <TextFieldRow
          label="Margin right"
          id="task-style-checkbox-margin-right"
          value={styles.checkbox.margin.right}
          onChange={(v) =>
            update("checkbox", { margin: { ...styles.checkbox.margin, right: v } })
          }
          unit="px"
          placeholder="8px"
        />
      </SectionGroup>

      {!styles.display.useCheckboxes && (
        <SectionGroup title="Bullet" defaultOpen={false}>
          <TextFieldRow
            label="Character"
            id="task-style-bullet-char"
            value={styles.bullet.char}
            onChange={(v) => update("bullet", { char: v })}
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
          <TextFieldRow
            label="Margin top"
            id="task-style-bullet-margin-top"
            value={styles.bullet.margin.top}
            onChange={(v) =>
              update("bullet", { margin: { ...styles.bullet.margin, top: v } })
            }
            unit="px"
            placeholder="2px"
          />
          <TextFieldRow
            label="Margin left"
            id="task-style-bullet-margin-left"
            value={styles.bullet.margin.left}
            onChange={(v) =>
              update("bullet", { margin: { ...styles.bullet.margin, left: v } })
            }
            unit="px"
            placeholder="0px"
          />
          <TextFieldRow
            label="Margin right"
            id="task-style-bullet-margin-right"
            value={styles.bullet.margin.right}
            onChange={(v) =>
              update("bullet", { margin: { ...styles.bullet.margin, right: v } })
            }
            unit="px"
            placeholder="8px"
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
          min={0}
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
