---
source: apps/web/src/components/bot-settings/blocked-viewers-card.tsx
tokens: [color.scheme, radius, tracking]
---

# Blocked Viewers Card

## Purpose

The body of the Bot settings Moderation page (`/dashboard/bot/moderation`): the block form and list, beside the mod-only chat commands. Blocking and unblocking save immediately through `config.blockViewer` / `config.unblockViewer`, the same services `!block` / `!unblock` use, so the dashboard list and chat share one list. It never joins the page's Save bar draft.

## Anatomy

- Two-column grid at `lg` (card + `18rem` legend): a `Card.panel` "Blocked viewers", then `CommandReference` "Mod commands in chat" of `moderationCommands` (under the card on small screens).
- Card body: the "Twitch username" field and an outline "Block viewer" button wrapped in `ConfirmDialog`, with a hint line under the field ("Block list is full. Unblock someone first." / "Letters, numbers and underscores only").
- Then the "Block list" section: an `h3`, the count as "n of 200", a "Filter blocked viewers" search field once the list holds more than `BLOCKED_FILTER_THRESHOLD` (8) names, and a hairline-divided list of logins (mono), each with a ghost "Unblock" button.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `blockedViewers` | `string[]` | The live `config.get` list (lowercase logins), not a draft |

No variants. Input runs through `normalizeTwitchLogin` (shared with the server schema and `!block`); the list caps at `MAX_BLOCKED_VIEWERS`.

## States

- **Empty**: "No blocked viewers." plus how a mod blocks from chat.
- **Filtered to nothing**: "No blocked viewer matches “…”."
- **Invalid input**: button disabled, hint shown, `aria-invalid` on the input.
- **Full**: button disabled, "Block list is full. Unblock someone first." hint (not marked invalid).
- **Pending**: block button disabled while blocking; every unblock button disabled while unblocking.
- **Result**: success / error toasts ("Blocked {login}", "Couldn't block that viewer: …").

## Accessibility

- The list section and list are `aria-labelledby` the "Block list" heading; each remove button is named `Unblock {login}`; the filter is labelled "Filter blocked viewers".
- Input labelled "Twitch username" (`#block-viewer-login`), described by the hint when one shows.
- Blocking confirms in an `alertdialog` titled `Block {login}?` (confirm label "Block"), because it also deletes that viewer's tasks.

## Do / Don't

- **Do** keep blocking immediate and confirmed; it is a moderation action, not a draft edit.
- **Do** normalize input with `normalizeTwitchLogin` so the dialog names exactly what is stored.
- **Don't** route blocking through the Save bar or keep an optimistic list; refresh `config.get` on success.
- **Don't** confirm unblocking: it is reversible and restores commands only.
