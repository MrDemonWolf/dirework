---
source: apps/web/src/components/bot-settings/blocked-viewers-card.tsx
tokens: [color.scheme, radius, tracking]
---

# Blocked Viewers Card

## Purpose

The Moderation card on `/dashboard/bot` (`bot-settings-page.tsx`): the mod-only chat commands beside the viewer block list. Blocking and unblocking save immediately through `config.blockViewer` / `config.unblockViewer`, the same services `!block` / `!unblock` use, so the dashboard list and chat share one list. It never joins the page's Save bar draft.

## Anatomy

- `Card.panel` header: `ConsoleRule` "Chat safety", `CardTitle` (h2) "Moderation", description.
- Two-column grid at `lg` (`15rem` legend + body): `CommandReference` of `moderationCommands` (ordered last on small screens), then a `SectionGroup` "Blocked viewers" with a trailing `CountBadge`.
- Body: a hairline-divided list of logins (mono) with a ghost destructive trash icon button each, then a "Twitch username" field and an outline "Block viewer" button wrapped in `ConfirmDialog`.
- Hint line under the field ("Block list is full" / "Letters, numbers and underscores only").

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `blockedViewers` | `string[]` | The live `config.get` list (lowercase logins), not a draft |

No variants. Input runs through `normalizeTwitchLogin` (shared with the server schema and `!block`); the list caps at `MAX_BLOCKED_VIEWERS`.

## States

- **Empty**: "No blocked viewers."
- **Invalid input**: button disabled, hint shown, `aria-invalid` on the input.
- **Full**: button disabled, "Block list is full" hint (not marked invalid).
- **Pending**: block button disabled while blocking; every unblock button disabled while unblocking.
- **Result**: success / error toasts ("Blocked {login}", "Couldn't block that viewer: …").

## Accessibility

- The list is `aria-labelledby` the section title id; each remove button is named `Unblock {login}`.
- Input labelled "Twitch username" (`#block-viewer-login`), described by the hint when one shows.
- Blocking confirms in an `alertdialog` titled `Block {login}?` (confirm label "Block"), because it also deletes that viewer's tasks.

## Do / Don't

- **Do** keep blocking immediate and confirmed; it is a moderation action, not a draft edit.
- **Do** normalize input with `normalizeTwitchLogin` so the dialog names exactly what is stored.
- **Don't** route blocking through the Save bar or keep an optimistic list; refresh `config.get` on success.
- **Don't** confirm unblocking: it is reversible and restores commands only.
