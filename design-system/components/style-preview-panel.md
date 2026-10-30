---
source: apps/web/src/components/theme-center/style-preview-panel.tsx
tokens: [color.scheme, radius, tracking]
---

# Style Preview Panel

## Purpose

Theme Center live preview on the Styles page (`styles-page.tsx`): renders the real overlay
components (`TimerDisplay`, `TaskListDisplay`) with the owner's unsaved styles over the shared
demo session (`DEMO_SESSION`, via `lib/preview-session.ts`), placed on a stream canvas the way
viewers see them. Entirely client-side; it never polls or calls the API.

## Anatomy

- Header row: `ConsoleRule` "Preview" (an `h2`) with the dirty chip ("Previewing unsaved
  changes" / "Matches the saved theme"; "Unsaved" / "Saved" below lg), and below lg a
  **Show / Hide** button (`aria-expanded`, `aria-controls` the body).
- Controls row: the Timer / Tasks source toggle and the backdrop swatches (dark, light,
  bright, checkerboard).
- Canvas (`figure`, sr-only `figcaption`): nothing but the overlays.
  - **Scene** (default): a 16:9 frame holding a 1920 × 1080 logical canvas
    (`STREAM_CANVAS`), scaled down as a whole with `AutoScale`. Both overlays sit at their
    true size and a usual spot (`previewSceneLayout`): the task list on the 700 × 800 source
    down the left edge, the timer top right on a source sized to its `dimensions`
    (`timerSourceSize`; 300 × 300 when they are `%`/`vw` lengths). Inside each source the
    markup matches its overlay page: the timer AutoScaled to fill, the list in a 16px pad.
    The selected source wears a `outline-link` outline outside its box, as OBS marks the
    selected source.
  - **Close-up**: the selected source alone, the canvas shaped to its aspect, for reading
    small type.
- Toolbar row under the canvas: **Play / Pause** (hidden in a task-list close-up), a
  `console-label` size readout ("300 × 300 in 1080p", or just "700 × 800" in a close-up),
  and the **Close-up** toggle.
- Below lg the page makes the panel a sticky bar under the header, above the editors. It
  starts collapsed (header row only); expanded, the scene spans the bar's width and a
  close-up is capped at `max-w-64` so the editors keep room. At lg it is the always-open
  `w-96` rail.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `timerStyles` | `TimerStylesConfig` | | Working (unsaved) styles |
| `taskStyles` | `TaskStylesConfig` | | Working styles |
| `phaseLabels` | `PhaseLabelsConfig` | | Working labels |
| `showHours` | `boolean` | `false` | The saved timer setting, so the preview clock is as wide as the overlay's |
| `dirty` | `boolean` | `false` | Working styles differ from the saved ones |

## States

- **Paused (initial)**: focus phase at the demo session's countdown, cycle 2/4.
- **Playing**: counts down one focus phase and loops when it hits 0.
- **Scene / Close-up**, Timer / Tasks selected.
- Backdrop: dark (default), light, bright, checkerboard.

## Accessibility

- Timer / Tasks and the backdrop swatches are `fieldset`s of `aria-pressed` buttons ("Preview
  timer" / "Preview tasks"; "Dark backdrop" …), not radiogroups, which would promise arrow
  keys they lack.
- Play/Pause and Close-up carry `aria-pressed`.
- The canvas `figcaption` says what is on screen (the scene, or which close-up).
- On coarse pointers the toggles, swatches, Play, Close-up and Show/Hide are at least 44px.
- `TimerDisplay`'s SVG has a `<title>`; `TaskListDisplay` keeps its scroll copy `aria-hidden`.
- No motion of its own beyond the timer's ring transition.

## Do / Don't

- **Do** render the real overlay components, so the preview matches OBS.
- **Do** keep every control outside the canvas; nothing may cover an overlay.
- **Do** keep literal backdrop colors in the `preview-scene-*` classes only; they simulate the
  scene behind the overlay, not app chrome.
- **Don't** fetch or poll from the preview.
- **Don't** fork preview-only overlay markup.
