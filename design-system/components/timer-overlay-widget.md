---
source: apps/fumadocs/src/app/(home)/_widgets/TimerOverlayWidget.tsx
tokens: [overlay, font.family]
---

# Timer Overlay Widget (docs mock)

## Purpose

A live mock of the OBS timer overlay on the docs landing page, rendered by
`theme-swatch` (`OverlayThemePreview`) inside its mock browser source. It shares the
squircle geometry (`roundedRectPath`, `roundedRectPerimeter`, `SQUIRCLE_RADIUS`), clock
formatting (`formatClock`, `cycleLabel`) and the demo session (`DEMO_SESSION`) with the
real overlay through `@dirework/overlay-kit`, so the preview can't drift from what
streamers get. The real renderer is `timer-ring` (`TimerDisplay`).

## Anatomy

- 250px square box (shrinks to its container), theme `bg` at 0.92, `22%` corners, a
  drop shadow.
- SVG squircle ring: track in theme `text` at 0.18, fill in theme `accent`, stroke 8,
  inset `8 / 2 + 2`.
- Centered column in Montserrat (`--font-display`): phase label (18px, bold, uppercase,
  accent), countdown (48px, bold, tabular digits), cycle line (16px, text at 0.6).

The mock is drawn smaller than the real 300px default; its proportions are illustrative,
not the pinned values in `timer-ring.md`.

## Props and variants

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `theme` | `OverlayTheme` | `OVERLAY_THEMES[DEFAULT_OVERLAY_THEME]` | One of the six generated presets |
| `paused` | `boolean` | `false` | Stops the mock countdown |

## States

- **Running**: counts down once a second from the demo session's mid-block value and
  wraps to a full block at zero; the ring sweeps with `stroke-dashoffset 1s linear`.
- **Paused**: the interval stops.
- **Reduced motion**: digits still tick (text change is not motion), but the ring steps
  instead of sweeping. Read live through `useSyncExternalStore`, with a `false` server
  snapshot so SSR and hydration agree.

## Accessibility

- One `role="img"` whose label names the phase and the time remaining; the SVG is
  `aria-hidden`.
- `user-select: none`: it is a picture of an overlay, not content.

## Do / Don't

- **Do** take geometry and formatting from `@dirework/overlay-kit`, never a local copy.
- **Do** change the session in `DEMO_SESSION`, not here.
- **Don't** add controls inside the mock; the pause button lives in `OverlayThemePreview`.
