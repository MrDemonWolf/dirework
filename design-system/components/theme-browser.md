---
source: apps/web/src/components/theme-center/theme-browser.tsx
tokens: [color.scheme]
---

# Theme Browser

## Purpose

Horizontal preset rail on the Styles page (`styles-page.tsx`): one `ThemeCard` per preset in `lib/theme-presets.ts`. Clicking a card applies the preset to the page's unsaved working styles.

## Anatomy

- Scroll-snapping flex rail (`overflow-x-auto`, `gap-3`) of `ThemeCard`s.
- Left and right edge fades (`from-background`, `aria-hidden`) that signal the rail scrolls.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `activeThemeId` | `string \| null` | The checked preset, if the working styles match one |
| `onApply` | `(theme: ThemePreset) => void` | Called on click / Enter / Space |

## States

- Roving tab stop starts on the checked card (or the first) and re-syncs when `activeThemeId` resolves after the config loads.

## Accessibility

- `role="radiogroup"` with `aria-label="Theme presets"`; each card is `role="radio"` with `aria-checked` (e2e pins both).
- Roving tabindex: one tab stop; arrow keys (Left/Up, Right/Down, wrapping) move focus ONLY. Enter, Space or click applies, so browsing never mutates the working styles.

## Do / Don't

- **Do** keep apply separate from focus movement.
- **Do** add presets in `lib/theme-presets.ts` (and their swatches in `tokens.json`).
- **Don't** apply a preset on arrow keys.
- **Don't** give every card `tabIndex={0}`.
