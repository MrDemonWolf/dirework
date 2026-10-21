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

- Header band: eyebrow, title and subtitle bars, and one pill chip (the timer status).
- A `stagger-reveal` grid (children rise in with `console-rise` on `--ease-console`, 60ms
  apart):
  - Timer hero (`panel-hero`): header, then `lg:grid-cols-5`: the instrument (chip, digits,
    rail, dots) in 3/5, and in 2/5 the transport bar, the folded settings bar and a monitor.
  - Task hero (`panel-hero`): header with two count blocks and the options button, then
    `lg:grid-cols-3`: the form and two task groups in 2/3, a monitor in 1/3.
  - Bot strip (`panel`): avatar, name, chip, action.
- `MonitorSkeleton` (internal) is the overlay monitor both heroes share: rule and size chip,
  URL row, then the hint and the Live preview toggle.

## Props and variants

`DashboardSkeleton()` takes no props. No variants.

## States

Static and data-free.

## Accessibility

Decorative. The entrance animation sits under the global reduced-motion gate. It renders no
headings or real text.

## Do / Don't

- **Do** update it alongside `dashboard.tsx`, `timer-controls.tsx` and `task-manager.tsx` so
  nothing jumps when data lands; `dashboard-layout.test.ts` pins the shared grid shapes.
- **Don't** fetch or accept data.
- **Don't** show it over a populated dashboard during a background refetch.
