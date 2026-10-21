---
source: apps/web/src/components/timer-status-badge.tsx
tokens: [color.scheme, font.size, tracking, radius]
---

# Timer Status Badge

## Purpose

Compact live timer status chip for the dashboard header, outside the timer console
(`dashboard/dashboard.tsx`). Shares the `timer.get` query key and
`DASHBOARD_TIMER_QUERY_OPTS` with `TimerProvider`, so it adds no extra request.

## Anatomy

A single `StatusChip` with the `chip-swap` class, keyed on the status so a change remounts it
and plays a one-shot crossfade.

## Props and variants

None. Tone and pulse come from `TIMER_TONES`; labels are fixed copy (they ignore the
streamer's custom phase labels):

| Status | Label | Tone |
|---|---|---|
| `idle` | Ready | idle |
| `starting` | Starting | accent, pulse |
| `work` | Focusing | live, pulse |
| `break` / `longBreak` | On Break | accent / alt, pulse |
| `paused` | Paused | warn |
| `finished` | Finished | alt |

## States

Before the first poll it reads "Ready". Unknown wire values fall back to idle
(`toTimerStatus`).

## Accessibility

Plain text label; not a live region (the console's `role="status"` span announces phase
changes). The pulse stops under reduced motion.

## Do / Don't

- **Do** keep it on the shared query key and options; a separate poll would double the cost.
- **Don't** show the custom phase labels here; the badge is fixed product copy.
