"use client";

import type { TimerStylesConfig } from "@/lib/config-types";
import { ColorInput } from "./color-input";
import { SliderRow, SwitchRow, TextFieldRow } from "./field-row";
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
    <div className="space-y-3">
      <SectionGroup title="Dimensions">
        <TextFieldRow
          label="Width"
          id="timer-style-dimensions-width"
          value={styles.dimensions.width}
          onChange={(v) => update("dimensions", { width: v })}
          unit="px"
          placeholder="280px"
        />
        <TextFieldRow
          label="Height"
          id="timer-style-dimensions-height"
          value={styles.dimensions.height}
          onChange={(v) => update("dimensions", { height: v })}
          unit="px"
          placeholder="280px"
        />
      </SectionGroup>

      <SectionGroup title="Background">
        <ColorInput
          label="Color"
          id="timer-style-bg-color"
          value={styles.background.color}
          onChange={(v) => update("background", { color: v })}
        />
        <SliderRow
          label="Opacity"
          id="timer-style-bg-opacity"
          value={Math.round(styles.background.opacity * 100)}
          onChange={(v) => update("background", { opacity: v / 100 })}
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <TextFieldRow
          label="Border Radius"
          id="timer-style-bg-border-radius"
          value={styles.background.borderRadius}
          onChange={(v) => update("background", { borderRadius: v })}
          placeholder="50%"
        />
      </SectionGroup>

      <SectionGroup title="Progress Ring">
        <SwitchRow
          label="Enabled"
          id="timer-style-ring-enabled"
          checked={styles.ring.enabled}
          onChange={(v) => update("ring", { enabled: v })}
        />
        <ColorInput
          label="Fill Color"
          id="timer-style-ring-fill-color"
          value={styles.ring.fillColor}
          onChange={(v) => update("ring", { fillColor: v })}
        />
        <SliderRow
          label="Fill Opacity"
          id="timer-style-ring-fill-opacity"
          value={Math.round(styles.ring.fillOpacity * 100)}
          onChange={(v) => update("ring", { fillOpacity: v / 100 })}
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <ColorInput
          label="Track Color"
          id="timer-style-ring-track-color"
          value={styles.ring.trackColor}
          onChange={(v) => update("ring", { trackColor: v })}
        />
        <SliderRow
          label="Track Opacity"
          id="timer-style-ring-track-opacity"
          value={Math.round(styles.ring.trackOpacity * 100)}
          onChange={(v) => update("ring", { trackOpacity: v / 100 })}
          min={0}
          max={100}
          format={(v) => `${v}%`}
        />
        <SliderRow
          label="Width"
          id="timer-style-ring-width"
          value={styles.ring.width}
          onChange={(v) => update("ring", { width: v })}
          min={2}
          max={20}
          format={(v) => `${v}px`}
        />
        <SliderRow
          label="Gap"
          id="timer-style-ring-gap"
          value={styles.ring.gap}
          onChange={(v) => update("ring", { gap: v })}
          min={0}
          max={20}
          format={(v) => `${v}px`}
        />
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
        <TextFieldRow
          label="Outline Size"
          id="timer-style-text-outline-size"
          value={styles.text.outlineSize}
          onChange={(v) => update("text", { outlineSize: v })}
          unit="px"
          placeholder="2px"
        />
        <FontSelect
          label="Font Family"
          value={styles.text.fontFamily}
          onChange={(v) => update("text", { fontFamily: v })}
        />
      </SectionGroup>

      <SectionGroup title="Font Sizes">
        <TextFieldRow
          label="Label"
          id="timer-style-font-label"
          value={styles.fontSizes.label}
          onChange={(v) => update("fontSizes", { label: v })}
          unit="px"
          placeholder="16px"
        />
        <TextFieldRow
          label="Time"
          id="timer-style-font-time"
          value={styles.fontSizes.time}
          onChange={(v) => update("fontSizes", { time: v })}
          unit="px"
          placeholder="48px"
        />
        <TextFieldRow
          label="Cycle"
          id="timer-style-font-cycle"
          value={styles.fontSizes.cycle}
          onChange={(v) => update("fontSizes", { cycle: v })}
          unit="px"
          placeholder="14px"
        />
      </SectionGroup>
    </div>
  );
}
