---
source: apps/web/src/components/stream-scene.tsx
tokens: [color.scheme, radius, overlay]
---

# Stream Scene

## Purpose

A static still of a co-working stream for the viewer landing page
(`app/(app)/viewer-landing.tsx`): the timer overlay, the task list overlay and the chat beside
them, all drawn from `DEMO_SESSION` in `@dirework/overlay-kit`, so the numbers and bot replies
match the docs mocks and share cards. Server-rendered: no polling, client state or timers.

## Anatomy

- `figure.panel-hero` with a header strip: a "Live" `StatusChip`, "Co-working stream", and an
  "Example" chip at the right.
- Canvas (`panel-inset bg-grain`): a squircle timer (`SQUIRCLE_RADIUS`, 8-unit ring in a
  200-unit viewBox, `stroke-primary` over `stroke-border`) beside a card listing tasks grouped
  by author with a `done/total done` counter.
- Chat strip (right column on `lg`, below on small screens): viewer commands in mono, bot
  replies under `BRAND.name` in `text-primary`.
- Viewer names cycle through `text-chart-2`, `text-warning`, `text-success`, one color per
  viewer across both the list and the chat.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `className` | `string` | none | Merged onto the `figure` |

No variants; content comes from `DEMO_SESSION`.

## States

One frozen moment, mid focus block. Task marks: done (check in a muted circle, struck-through
text), active (primary dot with a ring), pending (hollow dot).

## Accessibility

- The timer is `role="img"` with a label such as "Timer overlay: Focus, 18:24 left, 2/4".
- Each task carries an `sr-only` status prefix ("Working on it", "Up next", "Done").
- An `sr-only` `figcaption` describes the whole scene.
- Name colors are text tokens that clear AA on the card in both themes.

## Do / Don't

- **Do** change the demo content in `DEMO_SESSION`, not here, so every mock stays in sync.
- **Do** keep it static; it must cost no requests.
- **Don't** use it to preview the streamer's real theme; that is `style-preview-panel`.
