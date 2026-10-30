---
source: apps/web/src/components/overlay-icon.tsx
tokens: [color.scheme]
---

# Overlay Icon

## Purpose

The task overlay's bullet and checkbox tick. One of the fixed ids in `OVERLAY_ICONS`
(`@dirework/api/style-limits`: dot, circle, check, check-circle, square-check, star,
sparkles, arrow-right, chevron-right, paw-print, heart, flame, zap, none), drawn as an
inline lucide-react SVG (ISC). Used by `TaskListDisplay` (overlay, Theme Center preview,
landing scene) and the Theme Center `IconPickerRow` swatches.

## Anatomy

A single lucide `<svg>` with `width` and `height` set to `size` (the style's
`bullet.size` / `checkbox.tickSize`, any length the field allows) and stroke in
`currentColor`, so the parent's `bullet.color` / `checkbox.tickColor` paints it. `dot`
is a solid disc drawn inline (lucide's Dot is a thin ring). `none` renders nothing.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `icon` | `OverlayIcon` | Id from `OVERLAY_ICONS` |
| `size` | `string` | CSS length for both sides |
| `className` / `style` | | Passed to the SVG (the tick sets `color` here) |

## States

- One state per id; `none` is empty.

## Accessibility

- `aria-hidden` and not focusable: decorative, the row's text carries the meaning.

## Do / Don't

- **Do** import icons by name (tree-shaken), so the overlay bundle carries only this set.
- **Do** add an id to `OVERLAY_ICONS` and `OVERLAY_ICON_LABELS` together with its icon here.
- **Don't** accept free-text glyphs again; old stored glyphs read back through
  `toOverlayIcon` (a known glyph maps to its icon, anything else to the default).
