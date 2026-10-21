---
source: apps/fumadocs/src/app/(home)/_widgets/OverlayThemePreview.tsx
tokens: [overlay, color.scheme]
---

# Theme Swatch (OverlayThemePreview)

## Purpose

The interactive overlay showcase on the docs landing page: the timer and task mocks
(`TimerOverlayWidget`, `TaskListWidget`) inside a mock OBS browser source, restyled live
as the visitor picks one of the six presets. Local React state only; nothing talks to an
API. The presets come from `OVERLAY_THEMES` (generated from `tokens.json` `overlay.themes`
by `bun run tokens`), which mirrors `apps/web/src/lib/theme-presets.ts`. The in-app
counterpart is `theme-browser` / `theme-card`.

## Anatomy

- `figure` (`panel-inset`, max 520px) with decorative window chrome (traffic-light dots
  and a masked `/overlay/t/...` URL) above a `bg-checker` stage holding both widgets.
- A `fieldset` of preset buttons: each a pill with a 14px swatch (theme `bg` filled,
  theme `accent` inset ring) and the preset name.
- A text button that pauses or resumes the mock countdown.

## Props and variants

`OverlayThemePreview()` takes no props. The selected preset (default
`DEFAULT_OVERLAY_THEME`) and the paused flag are local state.

## States

- **Selected preset**: brand border and `--brand-50` tint, weight 600; the text stays
  `--txt-1` because brand text on the tint misses AA in light mode.
- **Paused**: freezes only the mock countdown.
- Focus: `focus-visible` ring in `--brand-500`.

## Accessibility

- Preset buttons carry `aria-pressed`; the group is labelled "Preview an overlay theme".
- The figure's `aria-label` names the theme shown; the window chrome is `aria-hidden`.
- The pause button's label names the action ("Pause preview timer" / "Resume preview
  timer"), so it has no `aria-pressed`.
- Buttons are at least 40px tall (`min-h-10`).

## Do / Don't

- **Do** change a preset's swatch colors in `tokens.json` and `theme-presets.ts`
  together; `theme-palette-sync.test.ts` fails when they drift.
- **Don't** edit `overlay-themes.generated.ts` by hand.
- **Don't** give the swatch meaning by color alone; the preset name is always shown.
