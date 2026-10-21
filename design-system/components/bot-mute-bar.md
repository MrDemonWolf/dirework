---
source: apps/web/src/components/bot-settings/bot-mute-bar.tsx
tokens: [color.scheme, tracking, motion]
---

# Bot Mute Bar

## Purpose

Slim full-width bar at the top of `/dashboard/bot` (`bot-settings-page.tsx`) holding the bot's mute switch. It saves on flip through `config.setBotMuted` (no Save bar): muting is an on-stream action, and it is the same switch mods flip with `!mute` / `!unmute`.

## Anatomy

- `.panel` row: `StatusChip`, an explanation sentence that changes with state, and a "Muted" `console-label` + `Switch` cluster.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `muted` | `boolean` | The live `config.get` value |

## States

- **Live**: chip `live` "Live".
- **Muted**: chip `warn` "Muted" with `pulse`.
- **Saving**: optimistic: the switch shows the requested value and stays disabled until `config.get` refetches (the mutation returns the invalidate promise, so it never flickers back).
- **Result**: toast "Bot muted" / "Bot unmuted", or "Couldn't change the mute switch: …".

## Accessibility

- `Switch` `#bot-muted-toggle` is labelled "Muted"; the label names what the switch controls and never flips to "On"/"Off".
- The chip pulse honours `prefers-reduced-motion`.

## Do / Don't

- **Do** keep it immediate; a mute that waits for Save is useless mid-stream.
- **Do** derive the optimistic value from `setBotMuted.variables`.
- **Don't** fold mute into the page draft or the Save bar.
- **Don't** rename the label per state.
