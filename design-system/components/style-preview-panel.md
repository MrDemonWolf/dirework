---
source: apps/web/src/components/theme-center/style-preview-panel.tsx
tokens: [color.scheme, radius, tracking]
---

# Style Preview Panel

## Purpose

Theme Center live preview on the Styles page (`styles-page.tsx`): renders the real overlay components (`TimerDisplay`, `TaskListDisplay`) with the owner's unsaved styles over a mock timer and mock tasks. Entirely client-side; it never polls or calls the API.

## Anatomy

- `.panel-hero` with a controls row: `ConsoleRule` "Preview canvas", a backdrop toggle (dark / light / checkerboard swatches), and a ghost Play/Pause button.
- Timer canvas (`.panel-inset` on the chosen backdrop) with `TimerDisplay` and a `console-label` size readout (`{width} × {height}`).
- `ConsoleRule` "Task list", then a task canvas at the recommended `700 / 800` aspect (max 360px wide) with `TaskListDisplay` over four mock tasks (several authors, one without a Twitch color, a done row) and a `700 × 800` readout.

- Header row: `ConsoleRule` "Preview" (an `h2`) with the dirty chip ("Previewing unsaved
  changes" / "Matches the saved theme"; "Unsaved" / "Saved" below lg), and below lg a
  **Show / Hide** button (`aria-expanded`, `aria-controls` the body).
- Below lg the page makes the panel a sticky bar under the header, above the editors. It
  starts collapsed (header row only); expanded, the canvas is capped at `max-w-64` so the
  editors keep room. At lg it is the always-open `w-96` rail.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `timerStyles` | `TimerStylesConfig` | | Working (unsaved) styles |
| `taskStyles` | `TaskStylesConfig` | | Working styles |
| `phaseLabels` | `PhaseLabelsConfig` | | Working labels |
| `showHours` | `boolean` | `false` | The saved timer setting, so the preview clock is as wide as the overlay's |

## States

- **Paused (initial)**: focus phase, cycle 2/4, frozen at the long-break length so the ring shows partially filled.
- **Playing**: counts down one focus phase and loops when it hits 0.
- Backdrop: dark (default), light, checkerboard.

## Accessibility

- Backdrop toggles are a `fieldset` (`aria-label="Preview backdrop"`) of `aria-pressed` buttons named "Dark backdrop" / "Light backdrop" / "Checkerboard backdrop" (not a radiogroup, which would promise arrow keys it lacks).
- Play/Pause carries `aria-pressed`.
- On coarse pointers the Timer/Tasks toggles, backdrop swatches, Play and Show/Hide are at
  least 44px.
- `TimerDisplay`'s SVG has a `<title>`; `TaskListDisplay` keeps its scroll copy `aria-hidden`.

## Do / Don't

- **Do** render the real overlay components, so the preview matches OBS.
- **Do** keep literal backdrop colors here only; they simulate the scene behind the overlay, not app chrome.
- **Don't** fetch or poll from the preview.
- **Don't** fork preview-only overlay markup.
