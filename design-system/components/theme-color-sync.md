---
source: apps/web/src/components/theme-color-sync.tsx
tokens: [color.scheme]
---

# Theme Color Sync

## Purpose

Keeps every `<meta name="theme-color">` on the app's own resolved theme, not the OS scheme,
so the browser bar matches the page. Mounted once by the `(app)` layout; overlays and the bot
console do not need a tinted bar.

## Anatomy

Not applicable: renders no UI (`return null`). An effect reads `useAppTheme().resolvedTheme`,
maps it through `themeColorFor` (`lib/theme-color.ts`) and writes the color to both
media-keyed theme-color tags.

## Props and variants

None.

## States

Unresolved theme (server, hydration): does nothing. Light or dark: writes that theme's color.

## Accessibility

Not applicable: renders no UI. The e2e suite checks the `meta[name="theme-color"]` value.

## Do / Don't

- **Do** keep the colors in `lib/theme-color.ts`, derived from the background tokens.
- **Don't** mount it outside the `(app)` layout.
