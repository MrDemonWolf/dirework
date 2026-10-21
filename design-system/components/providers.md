---
source: apps/web/src/components/providers.tsx
tokens: []
---

# Providers

## Purpose

Root client providers, mounted once by `app/layout.tsx` around every route: the theme
(`ThemeProvider`, next-themes), React Query (`QueryClientProvider` with the shared
`getQueryClient()`, so tRPC hooks and this provider share one cache), React Query devtools
(nothing in production builds), and the global toast host (`Toaster`). Non-visual apart from
the toasts.

## Anatomy

`ThemeProvider` (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`,
`disableTransitionOnChange`) wraps `QueryClientProvider` (children + devtools) and the
`Toaster` (`richColors`, safe-area offsets).

## Props and variants

| Export | Notes |
|---|---|
| `default Providers({ children })` | The wrapper |
| `TOAST_OFFSET` | Desktop toast offsets: 24px plus `env(safe-area-inset-*)` on bottom/left/right |
| `TOAST_MOBILE_OFFSET` | Mobile toast offsets: `1rem` plus the safe-area insets |

## States

None. Not applicable: renders no UI of its own.

## Accessibility

Not applicable directly. Toasts it hosts are announced by Sonner; the dark default matches
the dark-first design language.

## Do / Don't

- **Do** add app-wide context providers here, once.
- **Do** keep toasts clear of the notch and home indicator via the offset constants.
- **Don't** create a second `QueryClient`; use `getQueryClient()`.
- **Don't** mount another `Toaster` elsewhere.
