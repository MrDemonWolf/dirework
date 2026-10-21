---
source: apps/web/src/components/theme-provider.tsx
tokens: []
---

# Theme Provider

## Purpose

Theme state for the app. next-themes owns the theme (localStorage, the class on `<html>`, its
anti-flash script), but its provider wraps only a small bridge that copies its value into a
stable store (`lib/theme-store.ts`). Components read the theme with `useAppTheme()`. This
keeps next-themes' post-hydration context changes away from streamed Suspense boundaries,
which would otherwise discard the server HTML and render the dashboard twice. Mounted by
`providers.tsx`.

## Anatomy

Not applicable: renders no UI of its own. `ThemeStoreContext` (a store whose identity never
changes) wraps `NextThemesProvider` (containing only `ThemeStoreBridge`) and, as a sibling,
the app's children.

## Props and variants

| Export | Signature | Notes |
|---|---|---|
| `ThemeProvider` | `ComponentProps<typeof NextThemesProvider>` | Props pass through to next-themes |
| `useAppTheme` | `() => AppTheme` | `{ theme, resolvedTheme, setTheme }`; unresolved (`undefined`) on the server and during hydration |

## States

Unresolved until the bridge publishes, then light / dark / system. Only store subscribers
re-render on a change.

## Accessibility

Not applicable: renders no UI. Consumers (`mode-toggle`, `sonner`, `theme-color-sync`) keep
the mounted-state pattern because the value is unresolved on first render.

## Do / Don't

- **Do** read the theme with `useAppTheme()`.
- **Don't** call next-themes' `useTheme()` in components; it reintroduces the double render.
- **Don't** move `children` inside `NextThemesProvider`.
