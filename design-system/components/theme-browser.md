---
source: apps/web/src/components/theme-center/theme-browser.tsx
tokens: [color.scheme]
---

# Theme Browser

## Purpose

Preset gallery on the Styles page (`styles-page.tsx`): one `ThemeCard` per preset in `lib/theme-presets.ts`. Clicking a card applies the preset to the page's unsaved working styles.

## Anatomy

- A `grid-cols-2 md:grid-cols-3 xl:grid-cols-6` grid (`gap-3`) of `ThemeCard`s.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `activeThemeId` | `string \| null` | The checked preset, if the working styles match one |
| `onApply` | `(theme: ThemePreset) => void` | Called on click / Enter / Space |

## States

- The roving tab stop is the checked card (the first when no preset matches). While focus is in the gallery it follows focus; leaving the gallery hands it back to the checked card. It is derived during render (no sync effect), so a newly checked preset holds it at once.

## Accessibility

- `role="radiogroup"` with `aria-label="Theme presets"`; each card is `role="radio"` with `aria-checked` (e2e pins both).
- Roving tabindex through `lib/use-roving-grid.ts` (`useRovingGrid`, shared with the Icon Picker): one tab stop. Left/Right step and wrap, Up/Down move a row of the live grid, Home/End jump, and all of them move focus ONLY. Enter, Space or click applies, so browsing never mutates the working styles.
- Tab and Shift+Tab enter on the checked card, wherever the arrow keys last left focus (e2e `40-theme-center`).

## Do / Don't

- **Do** keep apply separate from focus movement.
- **Do** add presets in `lib/theme-presets.ts` (and their swatches in `tokens.json`).
- **Don't** apply a preset on arrow keys.
- **Don't** give every card `tabIndex={0}`.
