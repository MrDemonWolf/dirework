---
source: apps/web/src/components/theme-center/icon-picker.tsx
tokens: [color.scheme, radius, font.family, tracking]
---

# Icon Picker

## Purpose

Theme Center picker for the task overlay's bullet icon (`bullet.icon`) and checkbox tick
(`checkbox.tickIcon`). Replaces the old free-text glyph fields: the overlay draws only the
fixed `OVERLAY_ICONS` set, so every pick renders the same in OBS. Rendered by
`StyleSectionsEditor` for fields of kind `icon`.

## Anatomy

- The row label (and optional hint) on top, then a full-width `grid-cols-7` radiogroup of
  14 swatches (two rows), each an `OverlayIcon` at 18px; "None" is a mono caption.
- Swatch: `h-9` (`pointer-coarse:h-11`), `rounded-md`, `border-border`; the checked one
  takes `border-link` and a `bg-primary/10` fill.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Row label (`{id}-label`) |
| `id` | `string` | The radiogroup's id |
| `value` | `OverlayIcon` | Current id |
| `onChange` | `(value: OverlayIcon) => void` | Called on click / Enter / Space |
| `hint` | `string?` | One line under the label |

## States

- Checked / unchecked; hover lifts the swatch to `bg-muted`.

## Accessibility

- `role="radiogroup"` labelled by the row label; each swatch is `role="radio"` with
  `aria-checked` and an `aria-label` from `OVERLAY_ICON_LABELS`.
- Roving tabindex through `lib/grid-navigation.ts` (`nextGridIndex`, columns read from the
  live grid): arrows move focus, Home/End jump, Enter/Space/click picks, like the preset
  gallery.

## Do / Don't

- **Do** keep swatches at a 44px touch target on coarse pointers.
- **Don't** put the grid in the narrow `FieldRow` control column; it needs the row's width.
