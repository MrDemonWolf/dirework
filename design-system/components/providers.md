---
source: apps/web/src/components/providers.tsx
tokens: []
---

# Providers

## Purpose

The `(app)` routes' client providers, mounted by `app/(app)/layout.tsx` around the shell: the
theme (`ThemeProvider`, next-themes through the store bridge), React Query
(`QueryClientProvider` with the shared `getQueryClient()` from `utils/query-client.ts`, so tRPC
hooks and this provider share one cache) and React Query devtools (nothing in production
builds). Non-visual. The root layout mounts no providers: the `(overlay)` layout mounts only
`OverlayQueryProvider` and the `(bot)` layout none, so the token pages never load next-themes
and the bot page no React Query. The toast host is not here: `AppToaster` (`app-toaster.tsx`)
is its sibling in the `(app)` layout.

## Anatomy

`ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`,
`disableTransitionOnChange`) wraps `QueryClientProvider` (children + devtools).

## Props and variants

| Export | Notes |
|---|---|
| `default Providers({ children })` | The wrapper |

## States

None. Not applicable: renders no UI of its own.

## Accessibility

Not applicable directly. The dark default matches the dark-first design language.

## Do / Don't

- **Do** add context providers the `(app)` routes need here, once; a provider a token page
  needs goes in that group's layout, never the root.
- **Don't** create a second `QueryClient`; use `getQueryClient()`.
- **Don't** mount a `Toaster` here. It belongs to `AppToaster`.
