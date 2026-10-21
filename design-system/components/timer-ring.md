# Timer Ring (TimerOverlayWidget)

The Pomodoro progress ring as it appears in the OBS timer overlay. Two shapes:

- **Circle** — SVG `<circle>` with `strokeDasharray` / `strokeDashoffset`.
- **Squircle** — SVG `<path>` (rounded rect, default `22%` radius) via `roundedRectPath()`.

Mirrors `apps/web/src/components/timer-display.tsx` + helpers in `apps/web/src/lib/timer-utils.ts` (`formatTime`, `roundedRectPath`, `toHexOpacity`).

## Tokens

- Ring fill: phase color — `--phase-work` / `--phase-break` / `--phase-long-break` / `--phase-paused`.
- Track: ring color at low opacity (`toHexOpacity`).
- Surface: theme `bg`; time text: theme `text`.
- Display font: `--font-display` (Montserrat).

## Proportions (300×300 default)

- Ring width `14px`, gap `10px` from the edge: the ring sits `14/2 + 10 = 17px` in, so its
  box is 266px and the clear interior about 252px.
- Label `24px`, countdown `76px` (Montserrat bold, tabular digits), cycle `20px`; the column
  has a 4px gap (`gap-1`). `25:00` at 76px is about 234–240px wide, and the three lines stack
  to about 137px, so both fit inside the ring. With hours shown (or past 99 minutes),
  `clockFontSize` (timer-utils) scales the time down so `01:25:00` is no wider than `25:00`
  (about 49px at the default).
- Track opacity `0.14` on the default theme: present, but the fill reads first.
- The cycle line is the text color at `TIMER_CYCLE_OPACITY` (0.8), contrast-tested over the
  background composited on both black and white.

## Behavior

- Progress = elapsed / total for the active phase.
- Label shows phase name; cycle counter shows `n / total`.
- The docs widget animates a fake countdown; honor `prefers-reduced-motion`.

## Accessibility

- The overlay is a visual surface (browser source) — on docs, mark the mock `aria-hidden` or give it a text summary ("Timer: 18:24 of focus").
