---
source: apps/web/src/components/theme-center/field-row.tsx
tokens: [color.scheme, radius, tracking]
---

# Field Row

## Purpose

Shared editor row primitives for the Theme Center: one alignment grid for every control in the style editors. The label takes the free space and every control sits in the same fixed column right after it, so colors, lengths, fonts and sliders line up and share one width. Used by `ColorInput`, `FontSelect`, `style-field-groups` and `StyleSectionsEditor`.

## Anatomy

- Flex row, `min-h-8`, `gap-3`: a label column (`flex-1`) holding a `text-sm` foreground `Label` and an optional muted `text-xs` hint line under it, then the control column (`w-44`, `shrink-0`, content end-aligned).
- An optional destructive error line under the whole row.
- The row itself is not width-capped; `StyleSectionsEditor` caps each group at `max-w-md`, so a label is never a screen's width from its control.

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `FieldRow` | `label`, `id`, `labelledBy?`, `error?`, `hint?`, `children` | The grid. The label points at `id` (or, with `labelledBy`, for a non-labelable control, carries `{id}-label`); hint and error render as `{id}-hint` / `{id}-error` |
| `fieldDescribedBy` | `(id, hint?, invalid?)` | The `aria-describedby` value a row's control uses: the hint whenever there is one, the error while invalid |
| `TextFieldRow` | `label`, `id`, `value`, `onChange`, `unit?`, `placeholder?`, `hint?`, `steppable?`, `schema?` (default `cssLengthSchema`), `invalidHint?` | Full-width mono `Input` showing the whole value ("20px", "12px 18px"); no separate unit label. A bare number gets `unit` on blur (`withDefaultUnit`); with `steppable`, ArrowUp/ArrowDown nudge a single length by 1 (Shift: 10) keeping its unit (`stepLength`), and leave multi-value text to the key's default |
| `SliderRow` | `label`, `id`, `value`, `onChange`, `min`, `max`, `disabled?`, `format?`, `hint?` | `Slider` filling the control column plus a fixed-width (`w-11`) mono readout so values don't jitter |
| `SwitchRow` | `label`, `id`, `checked`, `onChange`, `hint?` | Small `Switch` at the end of the control column |

## States

- `TextFieldRow` invalid: `aria-invalid`, error "Use a CSS length like 12px, 50% or 1.5rem" (or `invalidHint`).
- `SliderRow` disabled passes through to the slider.
- Inputs inherit the `Input` primitive's sizes: `h-9` (`md:h-8`), `text-base` below `md` (no iOS zoom), `pointer-coarse:min-h-11`.

## Accessibility

- `FieldRow` errors are `aria-live="polite"`; controls point at hint and error via `aria-describedby` (`fieldDescribedBy`).
- `Slider` is not labelable, so `SliderRow` gives the label `{id}-label` and the slider `aria-labelledby` it (WCAG 4.1.2); `getAriaValueText` announces the formatted value ("40%", not "40").
- Arrow-key stepping only acts on a value it can parse; everything else keeps the browser's default caret movement.

## Do / Don't

- **Do** build every Theme Center control on these rows so the control column lines up.
- **Do** validate with the same schema the server applies, so a bad value is flagged at the field.
- **Do** keep hints to one short line that says what the field changes on the overlay.
- **Don't** hand-roll a label + control pair in an editor, or size a control other than to fill the column.
- **Don't** add a unit label beside a length; the value already carries its unit.
- **Don't** use `htmlFor` for a slider; pass `labelledBy` and point the slider's `aria-labelledby` at `{id}-label`.
