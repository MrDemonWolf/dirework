---
source: apps/web/src/components/theme-center/field-row.tsx
tokens: [color.scheme, radius, tracking]
---

# Field Row

## Purpose

Shared editor row primitives for the Theme Center: one alignment grid for every control in the style editors (label column left, right-aligned control cluster). Used by `ColorInput`, `FontSelect`, `style-field-groups`, `TimerStyleEditor` and `TaskStyleEditor`.

## Anatomy

- Grid `5rem | 1fr` (`6.5rem` from `md`), `min-h-8`: muted `text-xs` `Label`, then a right-aligned flex cluster.
- Optional right-aligned hint line and destructive error line below.

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `FieldRow` | `label`, `htmlFor?`, `labelId?`, `error?`, `errorId?`, `hint?`, `hintId?`, `children` | The grid; `labelId` is for non-labelable controls |
| `TextFieldRow` | `label`, `id`, `value`, `onChange`, `unit?`, `placeholder?`, `schema?` (default `cssLengthSchema`), `invalidHint?` | Free-text CSS value, validated inline against the server allowlist; a bare number gets `unit` on blur (`withDefaultUnit`); unit shown as a `console-label` |
| `SliderRow` | `label`, `id`, `value`, `onChange`, `min`, `max`, `disabled?`, `format?` | `Slider` filling the row plus a fixed-width (`w-10`) mono readout so values don't jitter |
| `SwitchRow` | `label`, `id`, `checked`, `onChange` | Small `Switch`, right-aligned |

## States

- `TextFieldRow` invalid: `aria-invalid`, error "Use a CSS length like 12px, 50% or 1.5rem" (or `invalidHint`).
- `SliderRow` disabled passes through to the slider.

## Accessibility

- `FieldRow` errors are `aria-live="polite"`; controls point at hint/error via `aria-describedby`.
- `Slider` is not labelable, so `SliderRow` gives the label `{id}-label` and the slider `aria-labelledby` it (WCAG 4.1.2); `getAriaValueText` announces the formatted value ("40%", not "40").

## Do / Don't

- **Do** build every Theme Center control on these rows so the columns line up.
- **Do** validate with the same schema the server applies, so a bad value is flagged at the field.
- **Don't** hand-roll a label + control pair in an editor.
- **Don't** use `htmlFor` for a slider; use `labelId`.
