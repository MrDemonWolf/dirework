---
source: apps/web/src/components/font-gate.tsx
tokens: []
---

# Font Gate

## Purpose

Keeps an OBS overlay `visibility: hidden` until the fonts its first render asked for have
loaded, or 1.5s (`MAX_WAIT_MS`) passes, so a browser-source refresh never draws the fallback
font and then reflows on stream. Used by both overlay pages (`/overlay/t/[token]` and
`/overlay/l/[token]`). Mostly non-visual: it renders a plain wrapper `div`.

## Anatomy

A single `div` that takes `className` and wraps `children`. Hidden content is still laid
out, which is what starts the font downloads; one animation frame later it waits on
`document.fonts.ready`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `className` | `string` | Applied to the wrapper (overlays pass their sizing classes) |
| `children` | `ReactNode` | The overlay content |

No variants.

## States

- **Waiting:** `visibility: hidden` (still occupies layout).
- **Ready:** no inline style; content shows. Reached on `fonts.ready` (resolved or
  rejected), on the 1.5s timeout, or immediately when `document.fonts` is unsupported.

## Accessibility

Not applicable to viewers: the overlay is a visual broadcast surface. While hidden the
content is also hidden from assistive tech, for at most 1.5s.

## Do / Don't

- **Do** wrap the whole overlay frame, so label, digits and rows appear together.
- **Don't** raise the timeout; a slow font must never blank a live overlay for long.
- **Don't** use `display: none`; it would stop the layout that triggers the font loads.
