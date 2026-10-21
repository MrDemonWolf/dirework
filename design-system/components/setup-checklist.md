---
source: apps/web/src/components/setup-checklist.tsx
tokens: [color.scheme, layout, radius]
---

# Setup Checklist

## Purpose

The dashboard's "Set up streaming" card: four handoff steps (connect the bot account, add
the bot page, the timer overlay and the tasks overlay to OBS) whose completion is the owner's
explicit confirmation, never detection. It also exports the header's reopen button.

## Anatomy

- `panel` section labelled by its `h2` "Set up streaming" with a `ConsoleRule` "Setup", a
  four-cell progress bar and an "N of 4" `CountBadge`.
- One row per step: number, title, state `StatusChip` (`Done` / `Added (you confirmed)` /
  `Not yet`), and the handoff — a link to Bot settings for step 1, a `SecretUrlRow` (no
  Reset) plus "I added it to OBS" / "Mark as not added" for steps 2–4.
- A completion row once every step is done; "Finish later" / "Close" collapses the card
  (component state first, `localStorage` best-effort); `SetupReopenButton` ("Setup N/4")
  reopens it from the header band and focuses the heading only on that click.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `me` | `SetupMe` | required | The hydrated `user.me` payload (`setup` flags + bot account) |
| `collapsed` | `boolean` | required | From `useSetupCollapsed` |
| `onCollapse` | `() => void` | required | |
| `headingRef` | `Ref<HTMLHeadingElement>` | none | Focus target for the reopen button |

## States

Fresh (0 of 4); in progress; all done (completion row, steps stay mounted for the visit);
collapsed; a step reverting after a failed save.

## Accessibility

- Names pinned by e2e: `Set up streaming`, `I added it to OBS`, `Mark as not added`,
  `Finish later`, `Setup`; chips `Done` / `Added (you confirmed)` / `Not yet`.
- Focus moves to the heading only after the reopen button is clicked, never on load.
- Every write is a functional patch of `setup` on the current `user.me` entry; a late
  response never overwrites newer state, and one guarded refetch covers overlaps and failures.

## Do / Don't

- **Do** keep detection out: a flag changes only on the owner's click (or a server write
  that invalidates it, such as a URL reset or disconnect).
- **Do** keep it free of polling — it reads the dashboard's hydrated `user.me`.
- **Don't** restore a cached snapshot on rollback; patch the one flag.
- **Don't** hide the step list the moment the last step completes.
