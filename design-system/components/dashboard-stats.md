---
source: apps/web/src/components/dashboard-stats.tsx
tokens: [color.scheme, font.size, tracking, radius, layout]
---

# Dashboard Stats

## Purpose

How the owner's streams are going, at a glance, on `/dashboard`: a readout strip under the
greeting (`StatTiles`) and a 14-day focus chart under the timer digits (`FocusChart`). Both
read `stats.summary`, which rides the dashboard's one SSR batch and is never polled.
`useStatsRefresh` refetches it when the timer or task polls the page already runs see a
phase change or a rising done count; `useTimeZoneSync` reports the browser's zone once when
the stored one differs. Copy, bar geometry and the refresh rule live in `lib/stats-view.ts`.

## Anatomy

- `StatTiles`: one `.panel` (`section`, "Today's stats") holding a `dl` grid, 2×2 below lg
  and one row of four from lg. Hairlines (`border-border/60`) form a cross on a phone and
  column rules on desktop; the cell classes come from `statCellClass`, shared with
  `StatTilesPlaceholder`. Each cell: `console-label` term, value in `font-heading text-2xl
  font-semibold`, detail in `text-xs text-muted-foreground`.
  Cells: Focus today (this week below), Pomodoros today (this week), Tasks done today (the
  chat share: "2 from chat", "All yours", "All from chat"), This week (focus days, then the
  week streak: "3-week streak", "5+ week streak" when it reaches the read window's start).
- `FocusChart`: a `figure` (max `max-w-sm`) with a caption row ("Focus, last 14 days" and
  the 14-day total, "17h 30m total"), an inline SVG of 14 columns (viewBox 280×56, bars 12 units wide,
  4px rounded tops, square at the baseline, a 2-unit stub for a zero day), and a date row
  (first day, "Today").

Colors: today's bar is `fill-primary` (the accent fill), earlier days
`fill-muted-foreground/55`; both themes come from the same tokens, no chart-only colors.
Values never wear the bar color; text stays in foreground / muted ink.

## Props and variants

None of them takes props (`useTimeZoneSync` takes the stored zone, `undefined` until `me`
loads). No variants.

## States

- Loading: the section's placeholder (`StatTilesPlaceholder`, `FocusChartPlaceholder`) only
  when `stats.summary` misses the first-paint deadline.
- Failed: the tiles show `QueryError` with a retry; the chart renders nothing.
- Zero data: tiles read "0m", "0", "None yet", "0 days · A focus day starts a streak"; the
  chart shows 14 baseline stubs.

## Accessibility

- Each bar carries a `<title>` ("Mon, Oct 26: 1 hour 5 minutes of focus") for hover; the
  SVG itself is `aria-hidden`, and an `sr-only` table lists every day's focus time, so no
  value depends on hover or color.
- The hit area of a bar is its whole slot, taller than the bar.
- Tiles are a `dl`: term, value, detail in reading order.

## Do / Don't

- **Do** keep it one series: today in the accent, the rest recessive.
- **Don't** poll `stats.summary` or add an observer that refetches on mount; refresh only
  through `useStatsRefresh`.
- **Don't** add a y-axis or gridlines; the total in the caption and the table carry the
  numbers.
