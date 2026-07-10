# Theme Swatch (OverlayThemePreview)

Preview grid of the 6 overlay themes. Each swatch renders a theme's `bg`, `accent`, and `text` colors from `OVERLAY_THEMES` (generated from `tokens.json` → `overlay.themes`).

## Anatomy

- Tile background = theme `bg`.
- A ring arc / dot in theme `accent`.
- Theme name in theme `text`.
- Selected/hover state lifts and adds a brand-tinted shadow.

## Tokens

Source data: `apps/fumadocs/src/app/(home)/_widgets/overlay-themes.generated.ts`. Card chrome: `--ds-color-surface-hairline`, `--ds-shadow-md`.

## Sync rule

The swatches mirror the `preview` field of each preset in `apps/web/src/lib/theme-presets.ts`. If a preset's preview changes, update `tokens.json` and run `bun run tokens`.

## Accessibility

- Theme name text must contrast against the theme `bg` (these are hand-checked in `tokens.json`).
- Grid is keyboard navigable if interactive; otherwise mark `aria-hidden` with a heading summary.
