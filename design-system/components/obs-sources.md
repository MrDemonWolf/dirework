---
source: apps/web/src/components/obs-sources.tsx
tokens: [color.scheme, radius, font.family]
---

# OBS Sources

## Purpose

Both overlay URLs in one place on the dashboard: the last block of the timer console's right
column (`dashboard/dashboard.tsx`, under Transport, "Now" and the session settings), so the
task board below can take the full width. One tab per overlay, so the page shows one masked
URL row at a time instead of two look-alike rows in two panels.

## Anatomy

- `ConsoleRule` `h3` "OBS sources" (`id="obs-sources-heading"`, which labels the `section`).
- `Tabs` (default "timer") with a full-width `TabsList` named "Overlay": "Timer" and "Tasks".
- Each `TabsContent`, top to bottom:
  - `SecretUrlRow` with Show / Copy / Reset (label "Timer overlay" / "Tasks overlay"; the
    reset confirm says an OBS source on the old URL goes blank).
  - "Add the URL as a browser source in OBS" beside the size chip: `300 × 300` for the timer,
    `700 × 800` for the tasks (a mono pill whose tooltip explains the size).
  - A ghost `xs` "Live preview" toggle (`aria-pressed`, eye / eye-off icon).
  - Below `lg`, while the toggle is on, a `panel-inset bg-grain` stage at the overlay's aspect
    ratio (`1 / 1`, `7 / 8`) holding the overlay page in an `iframe`.
- `ObsPreviewColumn` (from `lg`, while the toggle is on): the timer console's third column,
  an `aside` named "Live preview" with the selected overlay's name ("Timer overlay" /
  "Tasks overlay", `console-label` `h3`), a ghost `icon-xs` close (X) button and the same
  stage. The console's `.timer-console-grid` (index.css) goes from `1fr 40% 0` (3/5 · 2/5)
  to `1fr 20rem 18rem` (`22rem 22rem` from `xl`), sliding the instrument and controls over
  in `--motion-base`; reduced motion makes it instant.

## Props and variants

`ObsSources` and `ObsPreviewColumn` take `state` from `useObsPreview()`, which the timer
console (`dashboard.tsx`) owns: the selected tab, one preview switch for both tabs, and
`side` (`useMediaQuery(LG_MEDIA_QUERY)`, `lib/use-media-query.ts`; `false` on the server and
during hydration, harmless because the preview starts off). It reads `user.me` (both overlay tokens) from the cache the page's batch filled and
owns the `user.regenerateOverlayToken` mutation (toasts "New overlay URL ready — paste it
into OBS" or `Couldn't reset the URL: ...`).

## States

- `user.me` pending: both rows masked with their actions disabled, at full size (no shift).
- Only the selected tab's panel is mounted (Base UI default). The preview is one switch: with
  it on, switching tabs swaps the overlay shown (inline, or in the side column from `lg`).
- Preview off (default): no iframe exists. On: exactly one iframe exists, inline below `lg`
  or in the side column from `lg` (resizing across `lg` moves it). It is a live overlay that
  polls the api on the overlay cadence, so it stays opt-in.
- Reset pending: only that tab's Reset is disabled and spinning; the new URL reveals and
  flashes (`SecretUrlRow`).

## Accessibility

- e2e pins: tab "Timer" / "Tasks", buttons "Show <label> URL", "Reset <label> URL", textbox
  "<label> URL" (exact) once revealed. The Tasks tab must be selected before its row exists.
- The tab list is keyboard navigable (arrow keys, Base UI); on coarse pointers each trigger is
  at least 44px tall (`ui/tabs.tsx`).
- The preview toggle's name ends with an `sr-only` "of the timer overlay" / "of the tasks
  overlay"; the iframe is titled "<label> preview" and takes no pointer events.
- The side column's close button is "Close live preview"; it turns the preview off and hands
  focus back to the "Live preview" toggle (`data-obs-preview-toggle`).
- The size chip is a focusable button whose name carries the size and the hint, so keyboard
  and screen-reader users get the tooltip text.

## Do / Don't

- **Do** keep the preview iframe conditional on its toggle; a hidden one would still poll.
  Never render both stages and hide one with CSS: that is two polling overlays.
- **Do** keep the setup checklist's own URL handoffs separate (Show / Copy only); resetting
  lives here.
- **Don't** fetch here; `user.me` already rides the dashboard's one batch.
- **Don't** split the two overlays back into per-panel monitors; `dashboard-layout.test.ts`
  pins the single block.
