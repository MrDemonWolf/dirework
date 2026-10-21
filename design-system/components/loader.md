---
source: apps/web/src/components/loader.tsx
tokens: [color.scheme]
---

# Loader

## Purpose

Branded loading indicator: a spinning focus ring (the Pomodoro motif) instead of a generic
spinner. Currently imported by no page; route loading states use the page skeletons
(`DashboardSkeleton`, `StylesSkeleton`, `BotSettingsSkeleton`) or `Skeleton`. Kept for
indeterminate waits that have no layout to mirror.

## Anatomy

- Wrapper: `flex h-full items-center justify-center pt-8`.
- 32px SVG (`size-8`), spinning every 1.1s: a full track circle in `stroke-border` and a
  rounded arc (`strokeDasharray="40 126"`) in `stroke-primary`, both 5 units wide.

## Props and variants

Default export `Loader()`; no props, no variants.

## States

One: spinning.

## Accessibility

- `role="status"` with `aria-label="Loading"`; the SVG carries a `<title>Loading</title>`.
- The spin is an `animate-spin` utility, stopped by the global reduced-motion gate.

## Do / Don't

- **Do** prefer a layout-shaped skeleton when the final layout is known.
- **Do** use it for short indeterminate waits.
- **Don't** render several at once on one page.
- **Don't** hard-code colors; it follows `--border` and `--primary`.
