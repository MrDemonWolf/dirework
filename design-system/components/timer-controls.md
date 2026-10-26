---
source: apps/web/src/components/timer-controls.tsx
tokens: [color.scheme, color.phase, radius, tracking, font.size]
---

# Timer Controls

## Purpose

The dashboard timer console (`dashboard/dashboard.tsx`): the hero clock, its transport and the
session settings. Four exports share one context so the per-second countdown re-renders only
the instrument. On `lg` the console is a `grid-cols-5` panel: `TimerInstrument` in 3/5, and
in 2/5 `TimerTransport`, `TimerSettings` and `ObsSources` (both overlay URLs).

## Anatomy

- `TimerProvider` owns the `timer.get` poll (`DASHBOARD_TIMER_QUERY_OPTS`, the same key as
  `TimerStatusBadge`), seeds the editable fields once from `config.get`, holds the
  start / pause / resume / skip / reset mutations, and formats the settings summary from the
  SAVED config (`formatSessionSummary` in `lib/session-summary.ts`, `TIMER_CONFIG_DEFAULTS`
  for anything missing).
- `TimerInstrument`, top to bottom: a `StatusChip` with the phase label (keyed, `chip-swap`);
  an `sr-only` status line; `font-heading text-7xl lg:text-8xl` tabular digits over a
  phase-tinted radial glow (`TIMER_PHASE_COLOR`, 14%); a `h-1.5` phase rail; cycle dots (or a
  `01/12` mono counter above 10 cycles). While idle the dots preview the planned run, every
  dot hollow (or "12 pomos" above 10).
- `TimerTransport`: `[Start] [Skip] | [Stop]`. One primary `h-12` button, then, only while a
  run is in progress, `size-12` Skip and Stop icon buttons split by a hairline. The primary
  button may shrink (`min-w-0 flex-1`, truncating label) so Skip and Stop fit a 320px phone.
- `TimerSettings`: a `SectionGroup` "Edit session settings", folded by default, whose `summary`
  reads `FOCUS 25m · BREAK 5m · LONG 15m · EVERY 4` (each pair kept on one line). While a run
  is in progress it shows a "Locked" chip and "Stop the timer to change these." Five label /
  number input / unit rows (Focus 1-120 min, Break 1-60 min, Long break 1-60 min, Every 2-20
  pomos, Pomos 1-99): a flex row below `sm` (the label wraps, the unit slot is fixed), a
  `6.75rem 4.5rem auto` grid from `sm`.

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `TimerProvider` | `children: ReactNode` | Must wrap the other three |
| `TimerInstrument` | none | Throws outside `TimerProvider` |
| `TimerTransport` | none | Throws outside `TimerProvider` |
| `TimerSettings` | none | Throws outside `TimerProvider` |

Primary button by state: idle / finished = "Start" (default variant), paused = "Resume"
(default), running = "Pause" (outline). Phase colors: work = success, break / starting =
primary, long break / finished = cornflower, paused = warning, idle = muted.

## States

Idle (work length shown, rail hidden, hollow dots), starting, work, break, long break, paused
(amber, no pulse), finished. Pending mutations disable their button but keep it focusable.
Settings autosave on blur (clamped and rounded, no-op blurs skipped, "Timer settings saved"
toast) and are disabled while a run is in progress. The folded summary shows the saved values,
not unsaved field edits. Failures toast `Couldn't <action> the timer: ...`.

## Accessibility

- `role="status" aria-live="polite"` span announces "Timer: <phase>" on every phase change.
- The primary button is one element for Start / Pause / Resume, so focus survives state
  changes; when stopping unmounts Skip and Stop and focus falls to `<body>`, it moves back to
  the primary button.
- The cycle dots are an `img` named "Pomodoro 1 of 4" during a run and "4 pomodoros planned"
  while idle.
- e2e pins: button "Start" (exact), button "Stop timer" (opens an `alertdialog` whose confirm is
  also "Stop timer"), `img` "Pomodoro 1 of 4" for the cycle dots, the `1/4` text, the digits,
  and, at 320px, the "Edit session settings" button (by regex: its name carries the summary
  while folded) and the "pomos" unit. Skip is `aria-label` "Skip phase" with a tooltip.
- Each settings field has a `Label` and an `sr-only` help span wired by `aria-describedby`; the
  tooltip is only the pointer surface.

## Do / Don't

- **Do** keep the countdown inside `TimerInstrument` (`useTimerCountdown`); ticking in the
  provider re-renders every consumer.
- **Do** confirm Stop via `ConfirmDialog`; it discards the run.
- **Do** keep the transport and settings rows inside a 320px phone (`90-mobile.spec.ts`).
- **Don't** add a second `timer.get` poll; reuse the shared options.
- **Don't** treat the UI bounds as validation; `updateTimerConfigInput` is the authority.
