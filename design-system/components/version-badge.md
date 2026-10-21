---
source: apps/web/src/components/version-badge.tsx
tokens: [color.scheme, font.size, tracking, radius]
---

# Version Badge

## Purpose

Footer deploy readout in the `(app)` layout: `· <short sha>`, linked to the commit on GitHub.
Every deploy is one commit, so the SHA is the version. It polls `/api/version` every 5 minutes
(and when the tab becomes visible) and, when the live SHA differs from the one baked into the
tab, offers a reload.

## Anatomy

- A muted `·` separator (`aria-hidden`).
- The 7-character SHA in mono, linked to `github.com/mrdemonwolf/dirework/commit/<sha>` (new
  tab), or plain `dev` for local builds.
- When stale: a warning-toned chip button "New version — Reload" with a pulsing dot, styled
  like `StatusChip` (`text-2xs tracking-chip`).

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `sha` | `string \| undefined` | Build SHA; renders nothing when missing, never polls for `dev` |

## States

Current (link only), stale (link plus reload button), dev (plain text, no poll). Network
errors keep the current state.

## Accessibility

- The link's `title` reads "Deployed commit <sha> — view on GitHub"; the reload control is a
  real `<button>`.
- Keyboard focus draws `focus-visible:ring-2 ring-ring`.
- The pulsing dot is decorative and stops under reduced motion.

## Do / Don't

- **Do** keep the 5-minute cadence; it is one request per tab, well inside the free tier.
- **Don't** reload automatically; the streamer may have unsaved edits.
