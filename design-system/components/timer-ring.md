---
source: apps/web/src/components/timer-display.tsx
tokens: [overlay]
---

# Timer Ring (TimerDisplay)

## Purpose

The Pomodoro widget as the stream sees it: phase label, countdown, cycle line and an
optional progress ring. `TimerDisplay` renders it for the OBS timer overlay
(`/overlay/t/[token]`, wrapped in `AutoScale` and `FontGate`) and for the Theme Center
live preview (`style-preview-panel`), so the preview is the overlay. Pure presentation:
the overlay page owns polling and hands it the view from `timerOverlayView`
(`lib/overlay-view.ts`). The text lines are fitted inside the ring by `useTimerTextFit`
(`lib/use-timer-text-fit.ts`) with the pure geometry in `lib/timer-fit.ts`. The docs
landing mock (`TimerOverlayWidget`) shares its geometry and clock formatting through
`@dirework/overlay-kit`.

It reads the streamer's saved timer style, not the UI tokens; `overlay.squircleRadius`
in `tokens.json` mirrors the default 22% corner.

## Anatomy

- **Box**: fixed pixel size from `config.dimensions`, background color at
  `background.opacity`, corner from `background.borderRadius` (`22%` = squircle,
  `50%` = circle).
- **Ring** (`ProgressRing`, drawn when `ring.enabled` and both dimensions resolve to px):
  an SVG track plus a fill whose `stroke-dashoffset` shows the fraction remaining. A
  circle when the border radius is `50%`, else a rounded-rect path (`roundedRectPath`)
  whose corner follows the first border-radius value. The stroke is inset by
  `ring.width / 2 + ring.gap`, so at the default the ring sits `14 / 2 + 10 = 17px` in:
  a 266px box with a clear interior of about 252px.
- **Column** (`TIMER_LINE_GAP_PX`, 4px), centered: label (uppercase, `0.15em` tracking,
  medium), countdown (bold, `tabular-nums`, line-height 1.1), cycle line `{n}/{total}`.
  Lines never wrap.
- **Fit to the ring**: every line is measured at its configured size and shrunk (never
  grown) until it sits inside the ring's inner edge less `FIT_PADDING_PX` (6px) a side:
  the chord at the line's height for a circle, the inner width (narrowing in the corner
  bands) for a squircle, the panel itself with the ring off or with no room to draw it
  (`ringFitsFrame`, the rule `ProgressRing` skips by). See `fitShape` / `fitTimerLines`
  in `lib/timer-fit.ts`. One still too wide at `MIN_FIT_SCALE` (half size) ends in an
  ellipsis. So a long phase label ("Gathering the Pack" is about 290px at 20px) shrinks
  instead of spilling over the ring.

## Props and variants

`TimerDisplay({ config, state, totalDuration? })`

| Prop | Type | Notes |
| --- | --- | --- |
| `config` | `TimerStylesConfig & { labels, showHours }` | Saved styles (overlay) or unsaved edits (preview) |
| `state` | `TimerState` | Counts down locally from `targetEndTime` (`useTimerCountdown`) |
| `totalDuration` | `number` (ms), optional | Configured phase length; without it `phaseTotalMs` falls back to the canonical defaults |

Ring shape is the only visual variant: circle (`50%`) or squircle (anything else).

### Pinned values

Every value of the default theme (`DEFAULT_TIMER_STYLES`, `packages/db/src/defaults.ts`) and the
overlay constants. `spec-catalog.test.ts` derives the required rows from that object, so a
changed or added default fails until this spec moves with it.

| Value | Source | Default |
| --- | --- | --- |
| `dimensions.width` | `DEFAULT_TIMER_STYLES` | `300px` |
| `dimensions.height` | `DEFAULT_TIMER_STYLES` | `300px` |
| `background.color` | `DEFAULT_TIMER_STYLES` | `#091533` |
| `background.opacity` | `DEFAULT_TIMER_STYLES` | `0.92` |
| `background.borderRadius` | `DEFAULT_TIMER_STYLES` | `22%` |
| `ring.enabled` | `DEFAULT_TIMER_STYLES` | `true` |
| `ring.trackColor` | `DEFAULT_TIMER_STYLES` | `#ffffff` |
| `ring.trackOpacity` | `DEFAULT_TIMER_STYLES` | `0.14` |
| `ring.fillColor` | `DEFAULT_TIMER_STYLES` | `#00aced` |
| `ring.fillOpacity` | `DEFAULT_TIMER_STYLES` | `1` |
| `ring.width` | `DEFAULT_TIMER_STYLES` | `14` |
| `ring.gap` | `DEFAULT_TIMER_STYLES` | `10` |
| `text.color` | `DEFAULT_TIMER_STYLES` | `#ffffff` |
| `text.outlineColor` | `DEFAULT_TIMER_STYLES` | `#000000` |
| `text.outlineSize` | `DEFAULT_TIMER_STYLES` | `0px` |
| `text.fontFamily` | `DEFAULT_TIMER_STYLES` | `Montserrat` |
| `fontSizes.label` | `DEFAULT_TIMER_STYLES` | `20px` |
| `fontSizes.time` | `DEFAULT_TIMER_STYLES` | `64px` |
| `fontSizes.cycle` | `DEFAULT_TIMER_STYLES` | `18px` |
| `TIMER_CYCLE_OPACITY` | `lib/overlay-view.ts` | `0.8` |

At 300px, `25:00` at 64px is about 200px wide, leaving about 26px to the ring on each
side. The track at 0.14 is present, but the fill reads first. The cycle line is the text
color at `TIMER_CYCLE_OPACITY`, contrast-tested over the background composited on both
black and white (`theme-contrast.test.ts`).

## States

- **Idle**: shows the configured work length with a full ring, so the widget reads full
  while the streamer positions the OBS source.
- **Running** (work, short break, long break): label from `config.labels[status]`; the
  ring drains once per displayed second with a matching `stroke-dashoffset 1s linear`
  transition.
- **Paused**: the ring measures against the phase it froze in (`resolvePhaseDuration`).
- **Hours**: with `showHours` (or past 99 minutes), `clockFontSize` (`lib/timer-utils.ts`)
  shrinks the digits so `01:25:00` is no wider than `25:00` (about 41px at the default).
  It never grows text.
- **Fitted**: a long phase label, a wide font, a big size or a circle ring's narrower
  chord shrinks just the line that would cross the ring; below `MIN_FIT_SCALE` it ends in
  "…". It re-fits only when an input changes (the clock's length, not each tick) or a web
  font finishes loading.
- **No payload or reset token**: the overlay page renders nothing (`timerOverlayView`
  returns null), never a fake `00:00`.
- **Relative sizes**: `%` or `vw` dimensions can't be measured, so the ring is skipped
  rather than misdrawn.

## Accessibility

- The overlay is a browser-source surface, not an interactive page. The ring SVG carries
  `<title>Timer progress ring</title>`; the label, digits and cycle line are plain text.
- e2e (`30-timer.spec.ts`) reads the overlay by text: the work label
  (`DEFAULT_PHASE_LABELS.work`), the fresh digits and `1/4`, and checks that the longest
  default label and the clock (with and without hours) stay inside the ring's inner edge.
  Keep them visible text nodes, not images or pseudo-elements.
- `text.outlineSize` adds a `text-shadow` halo for legibility over busy scenes.

## Do / Don't

- **Do** change a default in `packages/db/src/defaults.ts` and the table above together.
- **Do** keep style values flowing through the `config-shared` allowlist schemas; this
  component interpolates them into inline CSS.
- **Don't** add a perpetual animation (pulse, glow): an overlay repaints on every frame
  of the stream.
- **Don't** compute the countdown from the poll; it ticks locally from `targetEndTime`.
- **Don't** let a text line wrap or grow past its configured size, and don't measure per
  tick or add a ResizeObserver: `useTimerTextFit` reads each box once per input change.
