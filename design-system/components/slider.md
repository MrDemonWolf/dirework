---
source: apps/web/src/components/ui/slider.tsx
tokens: [color.scheme]
---

# Slider

## Purpose

Base UI `Slider` for numeric ranges. Used by `FieldRow` in the Theme Center (opacities, ring
width and gap, scroll speed).

## Anatomy

- **Track**: `h-1.5` (horizontal) / `w-1.5` (vertical), `rounded-full`, `bg-input`.
- **Range**: `bg-primary` fill from the start to the thumb.
- **Thumb**: `size-4` white circle with a `border-2 border-primary` edge and `shadow-sm`; an
  invisible `after:-inset-3.5` pad widens its hit area. Aligned to the track edges
  (`thumbAlignment="edge"`). One thumb per value in the array.
- Vertical orientation has a `min-h-40` control.

## Props and variants

| Prop | Default | Notes |
|---|---|---|
| `value` / `defaultValue` | none | Number or array; an array renders one thumb per entry |
| `min` / `max` | `0` / `100` | |
| `getAriaValueText` | none | Forwarded to every thumb so callers announce units ("40%") |
| everything else | | `Slider.Root.Props` (`step`, `onValueChange`, `orientation`, `disabled`, ...) |

No visual variants.

## States

- Hover and drag (`active`) show a `ring-2 ring-ring/50` halo on the thumb.
- Keyboard focus lands on the thumb's nested `<input>`, so the cue keys off
  `has-[:focus-visible]`: a full-strength `outline-2 outline-offset-2 outline-ring`, distinct from the 50% hover ring.
- Disabled: 50% opacity, `cursor-not-allowed`.

## Accessibility

- Each thumb is `role="slider"` with `aria-valuemin/max/now`; pass `getAriaValueText` when the
  raw number is not what the user sees.
- Arrow keys step, Page Up/Down jump, Home/End go to the ends.
- Pair it with a visible label (and, in `FieldRow`, a numeric input) so the value is readable without dragging.

## Do / Don't

- **Do** announce units with `getAriaValueText`.
- **Do** offer a numeric input beside it for precise values.
- **Don't** shrink the thumb or remove the hit-area pad; touch users need it.
- **Don't** recolor the range per call site.
