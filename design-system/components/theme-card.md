---
source: apps/web/src/components/theme-center/theme-card.tsx
tokens: [color.scheme, font.size, radius, overlay]
---

# Theme Card

## Purpose

One preset tile in the Theme Center's `ThemeBrowser` rail. Its face is a mini overlay mock (timer ring + two task rows) so the card shows what BOTH overlays look like in that preset.

## Anatomy

- `button` `w-44`, `rounded-xl`, bordered.
- Face (`h-24`, `aria-hidden`) on the preset `bg`: a 56px ring (`r=19`, about 75% full) in `accent` over a `text` track at 0.18, `25:00` in `text-2xs` tabular display type; an open row (accent-bordered box + bar) and a done row (accent tick box + faded bar).
- Checked badge: a `bg-primary` circle with a check, top-left.
- Footer: preset name (`text-xs`) and a two-line-clamped description (`text-2xs`).

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `theme` | `ThemePreset` | | Reads `name`, `description`, `preview.{bg,accent,text}` |
| `isActive` | `boolean` | | Checked state |
| `onApply` | `() => void` | | Click / Enter / Space |
| `onFocus` | `() => void` | | Lets `ThemeBrowser` track the roving stop |
| `tabIndex` | `number` | `0` | Set by `ThemeBrowser` (0 on the focused card, -1 elsewhere) |

## States

- **Rest**: `border-border`; hover lifts `-translate-y-0.5` with a primary-tinted border and shadow.
- **Checked**: `border-primary` + `ring-primary/30` + check badge.
- **Focus-visible**: `ring-2 ring-ring` with `ring-offset-2 ring-offset-background` (the filled-card recipe).

## Accessibility

- `role="radio"` + `aria-checked` inside the "Theme presets" radiogroup; `title` carries name and description.
- The mock face is `aria-hidden`; the accessible name comes from the visible name and description.

## Do / Don't

- **Do** drive the face from `theme.preview` only; swatch colors live in `tokens.json` (`overlay.themes`) and are sync-tested.
- **Do** keep the offset focus ring so it clears the colored face.
- **Don't** use this tile outside a roving radiogroup.
- **Don't** truncate the description mid-word with a single-line ellipsis.
