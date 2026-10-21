---
source: apps/web/src/components/ui/sonner.tsx
tokens: [color.scheme, radius]
---

# Toaster (Sonner)

## Purpose

The app-wide toast host. `Providers` (`providers.tsx`) mounts one `Toaster`; code raises
toasts with `toast()` from `sonner` (save confirmations, mutation errors via
`lib/query-error-toast.ts`, the task Undo action).

## Anatomy

- Sonner's toast stack, themed from CSS variables: `--normal-bg: var(--popover)`,
  `--normal-text: var(--popover-foreground)`, `--normal-border: var(--border)`,
  `--border-radius: var(--radius)`.
- Lucide icons at `size-4`: `CircleCheckIcon` (success), `InfoIcon`, `TriangleAlertIcon`
  (warning), `OctagonXIcon` (error), `Loader2Icon` spinning (loading).
- Each toast carries the `cn-toast` class for global overrides.

## Props and variants

`Toaster` accepts every Sonner `ToasterProps`; they override the defaults above. `theme`
follows `useAppTheme()` (light / dark / system). Toast types (`success`, `error`, `info`,
`warning`, `loading`) are chosen per `toast.*()` call, not here.

## States

Entering, visible, hovered (paused), dismissing; stacked toasts expand on hover. The loading
icon spins; the global reduced-motion gate covers it.

## Accessibility

- Sonner renders an `aria-live` region, so toasts are announced politely. e2e reads
  "Styles saved", "Bot settings saved", "New overlay URL ready — paste it into OBS" and the
  "Undo" button from toasts.
- Action buttons inside a toast (Undo) are real buttons and keyboard reachable.

## Do / Don't

- **Do** use a shared toast id for repeated errors (`describeTrpcError` does) so they don't stack.
- **Do** keep toast text to one short sentence.
- **Don't** mount a second `Toaster`.
- **Don't** toast on overlay polls; overlay queries are `meta: { silent: true }`.
