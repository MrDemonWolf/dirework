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
- `StatTilesPlaceholder`: the stats strip under the greeting, a `.panel` of four cells
  (label, value, detail bars) laid out by the same `statCellClass` as `StatTiles`.
- `FocusChartPlaceholder`: the 14-day focus chart's caption row, a 5:1 plot block and the
  date row (`max-w-sm`).
- `TimerConsoleBodyPlaceholder`: the whole timer console: its one-line header (title bar and
  phase chip), then `lg:grid-cols-5`: the instrument (digits, rail, dots) above the focus
  chart placeholder in 3/5, and in 2/5 the transport bar, the folded settings bar and the OBS
  sources block. The "Now" line exists only with an active task, so it is left out.
- `TaskBoardPlaceholder`: the task board's one-line header (title bar, counts bar, options
  button), then the form and two task groups across the full width.
- `DashboardSkeleton`: header band bars plus the status placeholder, the stats strip, then a
  plain grid of the timer hero (`panel-hero` + its placeholder) and the task hero. No
  entrance animation.
- Internal: `PanelHeaderSkeleton` (the shared `PANEL_HEADER_CLASS` row with a 28px title bar)
  and `ObsSourcesSkeleton` (rule, tab list, URL row, hint with size chip, Live preview
  toggle; the tab list, URL row and toggle take their touch heights on coarse pointers).

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
