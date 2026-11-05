---
source: apps/web/src/components/version-badge.tsx
tokens: [color.scheme, font.size, tracking, radius]
---

# Version Badge

## Purpose

Footer deploy readout in the `(app)` layout: `· <short sha>`, linked to the commit on GitHub.
Every deploy is one commit, so the SHA is the version. In the signed-in owner's tab it checks
`/api/version` every `VERSION_CHECK_MS` (5 minutes, `lib/poll-intervals.ts`) while the tab is
visible, through `lib/version-check.ts`. A return to the tab checks only once 5 minutes have
passed since the last check. When the live SHA differs from the one baked into the tab, it
offers a reload and stops checking. Viewers on `/` and `/setup` get the static readout.

## Anatomy

- A muted `·` separator (`aria-hidden`).
- The 7-character SHA in mono, linked to `github.com/mrdemonwolf/dirework/commit/<sha>` (new
  tab), or plain `dev` for local builds.
- When stale: a warning-toned chip button "New version — Reload" with a pulsing dot, styled
  like `StatusChip` (`text-2xs tracking-chip`).

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `sha` | `string \| undefined` | Build SHA; renders nothing when missing, never checks for `dev` |
| `checkForUpdates` | `boolean` (default `false`) | Look for a newer deploy; the layout sets it for the signed-in owner only |

## States

Current (link only), stale (link plus reload button; checking has stopped), dev (plain text,
no checks), static (`checkForUpdates` off: no requests at all). Network errors keep the
current state, and the next check runs on the cadence.

## Accessibility

- The link's `title` reads "Deployed commit <sha> — view on GitHub"; the reload control is a
  real `<button>`.
- Keyboard focus draws `focus-visible:ring-2 ring-ring`.
- The pulsing dot is decorative and stops under reduced motion.

## Do / Don't

- **Do** keep the cadence in `VERSION_CHECK_MS`: one Worker request per check, at most 12 an
  hour, and none from a hidden tab.
- **Don't** check from a viewer's page or schedule a timer in the component; the scheduling
  lives in `lib/version-check.ts`, tested with fake timers.
- **Don't** reload automatically; the streamer may have unsaved edits.
