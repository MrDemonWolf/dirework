---
source: apps/web/src/components/bot-settings/bot-live-controls.tsx
tokens: [color.scheme, radius, motion]
---

# Bot Live Controls

## Purpose

The "Live controls" card on the Bot settings Overview (`/dashboard/bot`, `(sections)/overview-page.tsx`): the switches a streamer reaches for mid-stream (mute, Task commands, Timer commands) and the block list's size with a link to Moderation. Every switch saves the moment it flips; none of them is a draft, so nothing here goes through a Save bar.

## Anatomy

- `Card.panel` header: `CardTitle` (h2) "Live controls", description "Each switch takes effect as soon as you flip it."
- A hairline-divided list of rows; each row is a label (and, for mute, a small `StatusChip`), a one-line sentence under it, and the control at the right edge.
- Rows: "Mute bot" (`config.setBotMuted`), "Task commands" and "Timer commands" (`useCommandGroupSwitch` from `lib/use-command-group-switch.ts`, which sends only that flag to `config.updateBotSettings`), "Blocked viewers" ("n of 200 blocked" + a "Manage" link to `/dashboard/bot/moderation`, no prefetch).

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `muted` | `boolean` | Live `config.get` value |
| `taskCommandsEnabled` / `timerCommandsEnabled` | `boolean` | Live `config.get` values |
| `blockedCount` | `number` | Length of the live block list |
| `hasBotAccount` | `boolean` | Picks the mute chip copy (`botMuteStatus`) |

## States

- **Mute chip**: `idle` "Off" without a bot account, `warn` "Muted" (pulsing once an account exists), `accent` "Unmuted". It never says the bot is live: that depends on its bot page being open.
- **Group rows**: the sentence follows the switch ("Viewers add and finish their tasks from chat." / "The bot ignores task commands. !dw help still answers.").
- **Saving**: optimistic — the switch shows the requested value and stays disabled until `config.get` refetches (the mutation returns the invalidate promise, so it never flickers back).
- **Result**: toasts "Bot muted" / "Bot unmuted", "Task commands on" / "… off", or "Couldn't …: reason".

## Accessibility

- Each switch is labelled by its row label (`#bot-muted-toggle` "Mute bot", `#task-commands-live-toggle`, `#timer-commands-live-toggle`); labels name what the switch controls and never flip to "On"/"Off".
- The "Manage" link is a 44px-tall target. The chip pulse honours `prefers-reduced-motion`.

## Do / Don't

- **Do** keep these immediate; a mute that waits for Save is useless mid-stream.
- **Do** send only the flag that changed, so no page's draft is written.
- **Don't** repeat these switches' status elsewhere on the page.
- **Don't** claim the bot is running; the page can't know without polling.
