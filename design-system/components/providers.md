---
source: apps/web/src/components/providers.tsx
tokens: []
---

# Providers

## Purpose

Root client providers, mounted once by `app/layout.tsx` around every route: the theme
(`ThemeProvider`, next-themes), React Query (`QueryClientProvider` with the shared
`getQueryClient()`, so tRPC hooks and this provider share one cache) and React Query devtools
(nothing in production builds). Non-visual. The toast host is not here: the `(app)` layout
mounts `AppToaster` (`app-toaster.tsx`), so the OBS overlays and the bot page never load it.

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

- **Do** add context providers every route needs here, once.
- **Don't** create a second `QueryClient`; use `getQueryClient()`.
- **Don't** mount a `Toaster` here: every route, the OBS overlays included, would load sonner.
  It belongs to `AppToaster`.
