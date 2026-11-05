---
source: apps/web/src/components/user-menu.tsx
tokens: [color.partner]
---

# User Menu

## Purpose

The header's account control (`header.tsx`): a Twitch sign-in button when signed out,
otherwise the avatar dropdown, [account-menu](./account-menu.md). It gets the `(app)`
layout's server session, so the right control is in the server HTML with no loading flash.

## Anatomy

- Signed out: a `bg-twitch` `Button` with `TwitchIcon` and "Sign in". Hidden on `/` and
  `/setup`, which have their own Twitch buttons.
- Signed in: `AccountMenu`, loaded with `next/dynamic` (SSR on). Only a session renders it,
  so signed-out pages never fetch its chunk (Base UI Menu, floating-ui); signed-in pages
  request it with the page, never on a later click.

## Props and variants

Default export `UserMenu`.

| Prop | Type | Notes |
|---|---|---|
| `session` | `ServerSession \| null` | `null` renders the sign-in button |
| `links` | `AccountLinks` | Passed through to `AccountMenu` (Docs, Report a problem) |

## States

Signed out (sign-in button, or nothing on `/` and `/setup`), signed in (`AccountMenu`). The
sign-in click loads the auth client then (`lib/load-auth-client.ts`); if the chunk is gone
after a deploy, the page reloads.

## Accessibility

- The sign-in button is a real `button` named "Sign in".
- The signed-in roles and names are on [account-menu](./account-menu.md).

## Do / Don't

- **Don't** render a second Twitch sign-in on `/` or `/setup`.
- **Don't** import `@/lib/auth-client` or the dropdown primitives statically here; both would
  land on every signed-out page's first load.
