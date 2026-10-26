---
source: apps/web/src/components/status-chip.tsx
tokens: [color.scheme, font.size, tracking, radius]
---

# Status Chip

## Purpose

The LED-style status indicator of the Focus Console language: a small dot plus a mono
uppercase label. Shows timer phase, bot connection, unsaved changes, "Host"/"Focus"/"Started" task
markers and similar states. Used by the dashboard, `timer-controls`,
`task-manager`, `save-bar`, `stream-scene`, the bot-settings cards and the Theme Center page.

## Anatomy

- Pill (`rounded-full`) with a tone-tinted border (`/30`) and fill (`/10`).
- Leading dot `size-1.5`, `aria-hidden`, solid tone color; optional `animate-led-pulse`.
- Label: `font-mono text-2xs font-medium tracking-chip uppercase`, in a `truncate` span. The
  chip is `max-w-full shrink-0`: neighbours truncate before it does, and a label longer than
  the whole row ends in an ellipsis; pass `title` with the full text when a label may be cut.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tone` | `StatusTone` | `"idle"` | See tones below |
| `label` | `string` | required | Visible text (rendered uppercase) |
| `pulse` | `boolean` | `false` | Dot pulses; only while time is actually elapsing |
| `size` | `"default" \| "sm"` | `"default"` | `px-2.5 py-1` vs `px-2 py-0.5` |
| `dot` | `"solid" \| "half"` | `"solid"` | `half`: a `size-2` ring in the label color, its left half filled (◐); the task board's quieter "Started" chip. No pulse |
| `title` | `string` | none | Full label on hover, for a label that may be cut |
| `className` | `string` | none | Merged last |

| Tone (`StatusTone`) | Color | Meaning |
|---|---|---|
| `live` | `--success` (emerald) | Connected, running, focus phase |
| `warn` | `--warning` (amber) | Paused, unsaved |
| `accent` | `--link` (blue) | Starting, break, Host, a task in Focus |
| `alt` | `--cornflower` | Long break, finished |
| `idle` | `--muted-foreground` on `--muted` | Neutral, ready, locked |
| `danger` | `--destructive` | Errors, revoked |

Timer phases map to tones in `lib/status-tones.ts` (`TIMER_TONES`). The dashboard header's
bot chip comes from `dashboardBotChip` (`lib/bot-status.ts`): `live` "Bot connected" while a
bot page holds the chat lease (checked in within 5 minutes, per the last `user.me` answer),
`idle` "Bot offline" when none has, `idle` "Bot not connected" without a bot account. It
never goes offline on the local clock; `lib/bot-presence.ts` re-checks `user.me` when the
lease would run out.

## States

Static except for the optional pulse. Callers that swap the tone remount it with
`key={status}` and the `chip-swap` class for a one-shot crossfade.

## Accessibility

- The label is plain text; the dot is decorative, so color is never the only signal.
- Chip text on its `/10` tint is held to 4.5:1 in both themes by `tokens-contrast.test.ts`.
- The pulse stops under `prefers-reduced-motion: reduce`.
- It is not a live region; pair it with a `role="status"` span when a change must be
  announced (see `timer-controls`).

## Do / Don't

- **Do** pick the tone from its meaning, using `TIMER_TONES` for timer phases.
- **Do** keep labels to one or two words.
- **Don't** pulse a frozen state (paused, idle, finished).
- **Don't** make it clickable; it is a readout, not a button.
