---
source: apps/web/src/components/theme-center/style-field-groups.tsx
tokens: [color.scheme, radius, tracking]
---

# Style Field Groups

## Purpose

Reusable Theme Center field clusters (opacity, background, border, margins) shared by `TimerStyleEditor` and `TaskStyleEditor`. Each is controlled and emits the whole sub-object; free-text lengths are flagged inline by `TextFieldRow` against the server's `cssLengthSchema`.

## Anatomy

Fragments of `FieldRow`-based rows (no wrapper element), so they sit inside whichever `SectionGroup` the editor provides.

## Props and variants

| Export | Props | Renders |
|---|---|---|
| `OpacitySliderRow` | `label`, `id`, `value` (0–1), `onChange` | `SliderRow` 0–100 with `%` readout; the one place the ×100 / ÷100 lives |
| `BackgroundFields` | `idPrefix`, `value: { color, opacity }`, `onChange` | `ColorInput` "Background" (`{idPrefix}-bg-color`) + `OpacitySliderRow` "Background opacity" (`-bg-opacity`) |
| `BorderFields` | `idPrefix`, `value: { color, width, radius }`, `onChange`, `radiusPlaceholder?` (`"8px"`) | "Border color", "Border width" (px), "Border radius" (`-border-color` / `-border-width` / `-border-radius`) |
| `MarginFields` | `idPrefix`, `value: { top, left, right }`, `onChange` | "Margin top" / "Margin left" / "Margin right" (px) |

Value types come from `TaskStylesConfig` (`header.background`, `header.border`, `checkbox.margin`).

## States

Inherited from the rows: invalid lengths flagged inline; color drafts flagged on blur.

## Accessibility

- Ids are prefixed per use, so labels stay bound when a cluster appears several times on a page.
- Opacity announces as a percentage via `SliderRow`.

## Do / Don't

- **Do** use these clusters instead of repeating color/opacity/border rows in an editor.
- **Do** pass a unique `idPrefix` per instance.
- **Don't** store opacity as 0–100; the config is 0–1.
- **Don't** wrap them in their own section; the editor owns grouping.
