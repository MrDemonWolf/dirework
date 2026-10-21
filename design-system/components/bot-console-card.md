---
source: apps/web/src/components/bot-settings/bot-console-card.tsx
tokens: [color.scheme, radius, tracking]
---

# Bot Console Card

## Purpose

The hero card on `/dashboard/bot` (`bot-settings-page.tsx`) for the browser page that IS the bot: who chats where, the secret `/bot/<token>` URL with Show / Copy / Reset, an Open button, and OBS steps.

## Anatomy

- `Card.panel-hero` header: `ConsoleRule` "Console", `CardTitle` (h2) "Bot console", `CardAction` `StatusChip`, description warning that the URL is a secret.
- Body (account connected, data loaded): `{botUsername} chats in #{channelName}` (mono), `SecretUrlRow` labelled "Bot page", an "Open bot page" button (`<a target="_blank">`), and a collapsed flush `SectionGroup` "How to run it in OBS" with a numbered list.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `hasBotAccount` | `boolean` | Gates the `bot.getIngestInfo` query (`enabled`), so no request is spent without an account |

Reset calls `bot.regenerateBotToken`; the returned `chatToken` (`revoked` / `unconfirmed` / `no-account`) picks one of three fixed toasts, never Twitch's text.

## States

- **No bot account**: "Connect a bot account to activate the console."; chip `idle` "Not set up".
- **Loading**: `BotConsoleBodySkeleton`.
- **Load failed**: `QueryError` "Couldn't load the bot page URL" with Retry.
- **Ready**: chip `accent` "Ready".
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
