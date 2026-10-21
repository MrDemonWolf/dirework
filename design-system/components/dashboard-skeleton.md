---
source: apps/web/src/components/dashboard-skeleton.tsx
tokens: [color.scheme, radius, layout, motion]
---

# Dashboard Skeleton

## Purpose

Loading placeholder for the dashboard. A hard load streams the finished page (the server
prefetches its data), so it shows only on client navigation (`dashboard/loading.tsx`) and as
the fallback in `dashboard.tsx` when the server prefetch failed and `user.me` is fetching in
the browser.

## Anatomy

- Header band: eyebrow, title and subtitle bars, two pill chips.
- A `stagger-reveal` grid (children rise in with `console-rise` on `--ease-console`, 60ms
  apart):
  - Timer hero (`panel-hero`): header, then clock column, settings rail and preview rail,
    then the overlay-URL strip.
  - Task hero (`panel-hero`): header with two count blocks, the form and task groups beside
    a preview rail, then the URL strip.
  - Bot strip (`panel`): avatar, name, chip, action.
- `UrlStripSkeleton` (internal) is the URL strip both heroes share.

## Props and variants

`DashboardSkeleton()` takes no props. No variants.

## States

Static and data-free.

## Accessibility

Decorative. The entrance animation sits under the global reduced-motion gate. It renders no
headings or real text.

## Do / Don't

- **Do** update it alongside `dashboard.tsx` and `task-manager.tsx` so nothing jumps when
  data lands.
- **Don't** fetch or accept data.
- **Don't** show it over a populated dashboard during a background refetch.
