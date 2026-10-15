"use client";

import type { TaskStylesConfig } from "@/lib/config-types";
import { ColorInput } from "./color-input";
import { SliderRow, TextFieldRow } from "./field-row";

type BackgroundValue = TaskStylesConfig["header"]["background"];
type BorderValue = TaskStylesConfig["header"]["border"];
type MarginValue = TaskStylesConfig["checkbox"]["margin"];

/** 0–1 opacity edited as a 0–100% slider — the one place the ×100/÷100 lives. */
export function OpacitySliderRow({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <SliderRow
      label={label}
      id={id}
      value={Math.round(value * 100)}
      onChange={(v) => onChange(v / 100)}
      min={0}
      max={100}
      format={(v) => `${v}%`}
    />
  );
}

/** Background color + opacity pair (`${idPrefix}-bg-color` / `-bg-opacity`). */
export function BackgroundFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: BackgroundValue;
  onChange: (value: BackgroundValue) => void;
}) {
  return (
    <>
      <ColorInput
        label="Background"
        id={`${idPrefix}-bg-color`}
        value={value.color}
        onChange={(color) => onChange({ ...value, color })}
      />
      <OpacitySliderRow
        label="Background opacity"
        id={`${idPrefix}-bg-opacity`}
        value={value.opacity}
        onChange={(opacity) => onChange({ ...value, opacity })}
      />
    </>
  );
}

/** Border color, width and radius (`${idPrefix}-border-color` / `-width` / `-radius`). */
export function BorderFields({
  idPrefix,
  value,
  onChange,
  radiusPlaceholder = "8px",
}: {
  idPrefix: string;
  value: BorderValue;
  onChange: (value: BorderValue) => void;
  radiusPlaceholder?: string;
}) {
  return (
    <>
      <ColorInput
        label="Border color"
        id={`${idPrefix}-border-color`}
        value={value.color}
        onChange={(color) => onChange({ ...value, color })}
      />
      <TextFieldRow
        label="Border width"
        id={`${idPrefix}-border-width`}
        value={value.width}
        onChange={(width) => onChange({ ...value, width })}
        unit="px"
        placeholder="2px"
      />
      <TextFieldRow
        label="Border radius"
        id={`${idPrefix}-border-radius`}
        value={value.radius}
        onChange={(radius) => onChange({ ...value, radius })}
        placeholder={radiusPlaceholder}
      />
    </>
  );
}

/** Top / left / right margins (`${idPrefix}-margin-top` / `-left` / `-right`). */
export function MarginFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: MarginValue;
  onChange: (value: MarginValue) => void;
}) {
  return (
    <>
      <TextFieldRow
        label="Margin top"
        id={`${idPrefix}-margin-top`}
        value={value.top}
        onChange={(top) => onChange({ ...value, top })}
        unit="px"
        placeholder="2px"
      />
      <TextFieldRow
        label="Margin left"
        id={`${idPrefix}-margin-left`}
        value={value.left}
        onChange={(left) => onChange({ ...value, left })}
        unit="px"
        placeholder="0px"
      />
      <TextFieldRow
        label="Margin right"
        id={`${idPrefix}-margin-right`}
        value={value.right}
        onChange={(right) => onChange({ ...value, right })}
        unit="px"
        placeholder="8px"
      />
    </>
  );
}
