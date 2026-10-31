---
source: apps/fumadocs/src/app/(home)/_widgets/TaskListWidget.tsx
tokens: [overlay, font.family]
---

# Task List Widget (docs mock)

## Purpose

A static mock of the OBS task overlay on the docs landing page, rendered by
`theme-swatch` (`OverlayThemePreview`) next to the timer mock. Its sample tasks are the
shared `DEMO_SESSION` from `@dirework/overlay-kit`, so the list agrees with the hero
scene, chat preview and share cards. The real renderer is `task-card`
(`TaskListDisplay`).

## Anatomy

- 300px column (shrinks to its container) with a drop shadow, IBM Plex Sans body.
- One card per author, in first-appearance order, 10px apart:
  - **Header**: theme `bg` at 0.95, 12px top corners, author name in an AA-safe color
    from `authorPalette(theme.bg)` (three entries, cycled), `{done}/{total}` in theme
    `text` at 0.55; Montserrat bold.
  - **Body**: theme `bg` at 0.85, 12px bottom corners, rows 4px apart, each with a
    decorative 20px checkbox (tick in theme `accent`) and the task text (15px).
- Active row: a slightly stronger text tint plus a 3px accent edge. This differs from the
  real overlay (tint plus "Active" label); `task-card.md` is the source of truth.
- Started row: no edge and no extra tint, just an uppercase 11px "Started" label at the
  end of the row in the author's name color, like the real overlay's.

## Props and variants

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `OverlayTheme` | `OVERLAY_THEMES[DEFAULT_OVERLAY_THEME]` | One of the six generated presets |

## States

Static: one rendering per theme. Done rows are struck through and dimmed to text at 0.5.

## Accessibility

- One `role="img"` labelled "Task list overlay grouped by viewer", so screen readers get
  a summary instead of every sample task. Checkboxes are `aria-hidden`.
- Done uses strike-through and dimming together, never color alone.

## Do / Don't

- **Do** change the sample tasks in `DEMO_SESSION`, not here.
- **Do** keep author colors from `authorPalette`, which picks AA-safe colors per theme
  background.
- **Don't** copy grouping logic from the app; the mock groups its fixed demo data inline.
