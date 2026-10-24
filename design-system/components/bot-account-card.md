---
source: apps/web/src/components/bot-settings/bot-account-card.tsx
tokens: [color.scheme, color.partner, radius, tracking]
---

# Bot Account Card

## Purpose

Identity card on the Bot settings Overview (`/dashboard/bot`, `(sections)/overview-page.tsx`; first on the page while no account is connected, under Live controls once one is): which Twitch account the bot speaks as, with Connect (a plain link into the bot OAuth flow) or Disconnect.

## Anatomy

- `Card.panel` header: `CardTitle` (h2) "Bot account", `CardAction` with a `StatusChip`, description "The Twitch account that talks in your chat".
- Connected: Twitch-purple tile (`bg-twitch/15` + `TwitchIcon`, `aria-hidden`), display name and mono `@username`, a destructive small "Disconnect" button inside `ConfirmDialog`, then a tip to `/mod` the bot.
- Not connected: explanation copy and a Twitch-purple "Connect bot account" button rendered as `<a href="/api/bot/authorize">`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `botAccount` | `{ displayName: string; username: string } \| null` | `null` renders the connect state |
| `onDisconnect` | `() => void` | Called after the confirm dialog |
| `disconnecting` | `boolean` | Disables the Disconnect trigger |

## States

- **Connected**: chip `live` "Connected".
- **Not connected**: chip `idle` "Not connected".
- **Disconnecting**: trigger disabled.

## Accessibility

- Connect is a real link (`nativeButton={false}` + `render={<a>}`), not `next/link`: `/api/bot/authorize` is a proxied route handler that redirects to Twitch.
- Disconnect confirms in an `alertdialog` ("Disconnect the bot account?", confirm "Disconnect bot").
- The avatar tile is decorative; the name is plain text.

## Do / Don't

- **Do** keep Twitch purple to the Connect button and the Twitch tile.
- **Do** confirm Disconnect: it revokes the Twitch authorization and takes any open bot page offline.
- **Don't** swap the Connect anchor for `next/link` or a client fetch; the browser must follow the redirect.
- **Don't** show tokens or scopes here; no procedure returns them.
