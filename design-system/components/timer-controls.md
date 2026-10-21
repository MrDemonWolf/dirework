---
source: apps/web/src/components/timer-controls.tsx
tokens: [color.scheme, color.phase, radius, tracking, font.size]
---

# Timer Controls

## Purpose

The dashboard timer console (`dashboard/dashboard.tsx`): the hero clock with its transport
and the duration settings. Three exports share one context so the per-second countdown
re-renders only the instrument.

## Anatomy

- `TimerProvider` owns the `timer.get` poll (`DASHBOARD_TIMER_QUERY_OPTS`, the same key as
  `TimerStatusBadge`), seeds the editable fields once from `config.get`, and holds the
  start / pause / resume / skip / reset mutations.
- `TimerInstrument`, top to bottom: a `StatusChip` with the phase label (keyed, `chip-swap`);
  an `sr-only` status line; `font-heading text-7xl lg:text-8xl` tabular digits over a
  phase-tinted radial glow (`TIMER_PHASE_COLOR`, 14%); a `h-1.5` phase rail; cycle dots (or a
  `01/12` mono counter above 10 cycles; a "4 pomos · 25m focus · 5m break" summary while idle);
  then the transport: one primary button plus a segmented Skip / Stop cluster while running.
- `TimerSettings`: a `ConsoleRule` "Settings", a "Locked while running" chip when not idle,
  then five label / number input / unit rows (Focus 1-120 min, Break 1-60 min, Long break
  1-60 min, Every 2-20 pomos, Pomos 1-99).

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `TimerProvider` | `children: ReactNode` | Must wrap the other two |
| `TimerInstrument` | none | Throws outside `TimerProvider` |
| `TimerSettings` | none | Throws outside `TimerProvider` |

Primary button by state: idle / finished = "Start" (default variant), paused = "Resume"
(default), running = "Pause" (outline). Phase colors: work = success, break / starting =
primary, long break / finished = cornflower, paused = warning, idle = muted.

## States

Idle (work length shown, rail hidden), starting, work, break, long break, paused (amber, no
pulse), finished. Pending mutations disable their button but keep it focusable. Settings
autosave on blur (clamped and rounded, no-op blurs skipped, "Timer settings saved" toast) and
are disabled while a run is in progress. Failures toast `Couldn't <action> the timer: ...`.

## Accessibility

- `role="status" aria-live="polite"` span announces "Timer: <phase>" on every phase change.
- The primary button is one element for Start / Pause / Resume, so focus survives state
  changes; when Stop unmounts the cluster and focus falls to `<body>`, it moves back to the
  primary button.
- e2e pins: button "Start" (exact), button "Stop timer" (opens an `alertdialog` whose confirm is
  also "Stop timer"), `img` "Pomodoro 1 of 4" for the cycle dots, the `1/4` text, and the
  digits. Skip is `aria-label` "Skip phase" with a tooltip.
- Each settings field has a `Label` and an `sr-only` help span wired by `aria-describedby`; the
  tooltip is only the pointer surface.

## Do / Don't

- **Do** keep the countdown inside `TimerInstrument` (`useTimerCountdown`); ticking in the
  provider re-renders every consumer.
- **Do** confirm Stop via `ConfirmDialog`; it discards the run.
- **Don't** add a second `timer.get` poll; reuse the shared options.
- **Don't** treat the UI bounds as validation; `updateTimerConfigInput` is the authority.
