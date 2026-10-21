---
source: apps/web/src/components/theme-center/timer-style-editor.tsx
tokens: [color.scheme, radius, tracking]
---

# Timer Style Editor

## Purpose

Theme Center editor for the timer overlay's styles: the Timer tab of `/dashboard/styles` (`styles-page.tsx`). A controlled form over `TimerStylesConfig`; every edit emits a full new styles object that the page holds as unsaved working state (driving `StylePreviewPanel`) until Save.

## Anatomy

Stacked `SectionGroup`s built from `FieldRow` rows:

| Section | Fields (ids `timer-style-*`) |
|---|---|
| Dimensions | Width, Height (px) |
| Background | Color, Opacity, Border radius |
| Progress ring | Enabled (switch), Fill color, Fill opacity, Track color, Track opacity, Width (slider 2–24px), Gap (slider 0–16px) |
| Text | Color, Outline color, Outline size, Font family (`FontSelect`) |
| Font sizes | Phase label, Time, Pomo counter |

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `styles` | `TimerStylesConfig` | Controlled |
| `onChange` | `(styles: TimerStylesConfig) => void` | Emits the whole object (one section shallow-merged per edit) |

## States

- Inline validation per row (`cssLengthSchema`); invalid lengths are flagged at the field.
- Dimensions must be absolute lengths for the ring: with `%` / `vw` / `vh`, `TimerDisplay` skips the ring rather than misdrawing it.

## Accessibility

- Every control has a unique `timer-style-*` id bound to its label; sliders use `aria-labelledby` and announce their px / % values.

## Do / Don't

- **Do** keep defaults in `DEFAULT_TIMER_STYLES` (`@dirework/db/defaults`); never re-type them here.
- **Do** reuse `OpacitySliderRow` for every opacity.
- **Don't** add a field the server's timer style schema doesn't accept.
- **Don't** persist from here; the page's Save bar does (e2e expects "Styles saved").
