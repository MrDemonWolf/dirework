---
source: apps/web/src/components/dashboard-skeleton.tsx
tokens: [color.scheme, radius, layout, motion]
---

# Dashboard Skeleton

## Purpose

Loading placeholders for the dashboard: one per progressive section, plus the whole-page
`DashboardSkeleton` composed from them. A hard load paints the finished dashboard whenever its
data arrives within `SECTIONS_READY_MS` (800ms, `lib/progressive.ts`), so a section's
placeholder shows only when that section's data is slower, inside the otherwise finished
page. `DashboardSkeleton` shows on client navigation (`dashboard/loading.tsx`), before the
session is known.

## Anatomy

- `StatusClusterPlaceholder`: two pill chips (timer status, bot) for the header band's
  cluster; the bot chip's slot takes the link's 44px touch height.
- `TimerConsoleBodyPlaceholder`: the timer console below its heading, `lg:grid-cols-5`: the
  instrument (chip, digits, rail, dots) in 3/5, and in 2/5 the transport bar, the folded
  settings bar and a monitor.
- `TaskBoardPlaceholder`: the task board's header with two count blocks and the options
  button, then `lg:grid-cols-3`: the form and two task groups in 2/3, a monitor in 1/3.
- `DashboardSkeleton`: header band bars plus the status placeholder, then a plain grid of the
  timer hero (`panel-hero`, heading bars + body placeholder) and the task hero. No entrance
  animation.
- `MonitorSkeleton` (internal) is the overlay monitor both heroes share: rule and size chip,
  URL row, then the hint and the Live preview toggle.

## Props and variants

None of them takes props. No variants.

## States

Static and data-free.

## Accessibility

Decorative. In the live dashboard each section placeholder sits in a `SectionPlaceholder`
(`aria-hidden`); the skeleton shimmer stops under the global reduced-motion gate. It renders
no headings or real text (the live page's static headings stay outside the placeholders).

## Do / Don't

- **Do** update a placeholder alongside its section in `dashboard.tsx`, `timer-controls.tsx`
  and `task-manager.tsx` so nothing jumps when data lands; `dashboard-layout.test.ts` pins the
  shared grid shapes.
- **Don't** fetch or accept data.
- **Don't** show it over a populated section during a background refetch.
