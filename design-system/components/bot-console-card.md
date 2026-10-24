---
source: apps/web/src/components/bot-settings/bot-console-card.tsx
tokens: [color.scheme, radius, tracking]
---

# Bot Console Card

## Purpose

The "Run the bot" card on the Bot settings Overview (`/dashboard/bot`, `(sections)/overview-page.tsx`) for the browser page that IS the bot: who chats where, the secret `/bot/<token>` URL with Show / Copy / Reset, an Open button, and where to keep the page open.

## Anatomy

- `Card.panel` header: `CardTitle` (h2) "Run the bot", `CardAction` `StatusChip`, description warning that the URL is a secret.
- Body (account connected, data loaded): `{botUsername} chats in #{channelName}` (mono), `SecretUrlRow` labelled "Bot page" (with Reset), a second one labelled "Bot dock" (`?view=dock`, no Reset of its own — the same token), an "Open bot page" button (`<a target="_blank">`), and a collapsed flush `SectionGroup` "Where to keep it" with a numbered list.

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

- `SecretUrlRow` supplies the named controls (`Show Bot page URL`, the `Bot page URL` textbox, the reset confirm).
- The OBS icon is `aria-hidden`; the steps are an ordered list.
- Open uses `rel="noopener noreferrer"`.

## Do / Don't

- **Do** treat the URL as a secret: masked by default, reset behind a confirm.
- **Do** keep reset toasts as fixed copy keyed on `chatToken`.
- **Don't** enable `getIngestInfo` without a bot account; every dashboard request is billed twice.
- **Don't** put the token in toasts or logs.
