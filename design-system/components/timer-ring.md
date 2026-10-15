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

## Behavior

- Progress = elapsed / total for the active phase.
- Label shows phase name; cycle counter shows `n / total`.
- The docs widget animates a fake countdown; honor `prefers-reduced-motion`.

## Accessibility

- The overlay is a visual surface (browser source) — on docs, mark the mock `aria-hidden` or give it a text summary ("Timer: 18:24 of focus").
