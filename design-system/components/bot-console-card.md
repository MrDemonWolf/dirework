---
source: apps/web/src/components/bot-settings/bot-console-card.tsx
tokens: [color.scheme, radius, tracking]
---

# Bot Console Card

## Purpose

The "Run the bot" card on the Bot settings Overview (`/dashboard/bot`, `(sections)/overview-page.tsx`) for the browser page that IS the bot: who chats where, then the widget / dock handoff with the chosen secret URL, Show / Copy / Reset, an Open button for that view, and its steps.

## Anatomy

- `Card.panel` header: `CardTitle` (h2) "Run the bot", `CardAction` `StatusChip`, description warning that the URL is a secret and that the bot runs only while its widget or dock is open.
- Body (account connected, data loaded): `{botUsername} chats in #{channelName}` (mono), then `BotPageHandoff` with `reset` (Reset on the row; one token, so the confirm is "Reset both bot page URLs?") and `renderAction`: an outline "Open widget" / "Open dock" button (`<a target="_blank">`) for the chosen view.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `hasBotAccount` | `boolean` | Gates the `bot.getIngestInfo` query (`enabled`), so no request is spent without an account |

Reset calls `bot.regenerateBotToken`; the returned `chatToken` (`revoked` / `unconfirmed` / `no-account`) picks one of three fixed toasts, never Twitch's text.

## States

- **No bot account**: "The bot page URL appears here once a bot account is connected."; chip `idle` "Not set up".
- **Loading**: `BotConsoleBodySkeleton`.
- **Load failed**: `QueryError` "Couldn't load the bot page URL" with Retry.
- **URL ready**: chip `accent` "URL ready" (never "live": whether the page is open is unknowable without polling).
- **Open disabled** until `useOrigin` resolves (it is empty during SSR and hydration).

## Accessibility

- `BotPageHandoff` supplies the radiogroup and the named controls (`Show Widget URL`, the `Dock URL` textbox, the reset confirm).
- Open uses `rel="noopener noreferrer"`.

## Do / Don't

- **Do** treat the URL as a secret: masked by default, reset behind a confirm.
- **Do** keep reset toasts as fixed copy keyed on `chatToken`.
- **Don't** enable `getIngestInfo` without a bot account; every dashboard request is billed twice.
- **Don't** put the token in toasts or logs.
