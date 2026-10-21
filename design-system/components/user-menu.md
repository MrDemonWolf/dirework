---
source: apps/web/src/components/user-menu.tsx
tokens: [color.scheme, color.partner, radius]
---

# User Menu

## Purpose

The header's account control (`header.tsx`): a Twitch sign-in button when signed out,
otherwise an avatar dropdown with the dashboard links and Sign out. It gets the `(app)`
layout's server session, so the right control is in the server HTML with no loading flash.

## Anatomy

- Signed out: a `bg-twitch` `Button` with `TwitchIcon` and "Sign in". Hidden on `/`, which has
  its own quiet owner sign-in.
- Signed in: a round trigger (avatar image or a CSS-drawn initial on `bg-primary`, the name
  from `sm` up, a chevron) opening a `DropdownMenu` (`w-56 bg-card`, aligned end):
  Dashboard, Theme Center, Bot (links), a separator, then a destructive Sign out item.

## Props and variants

Default export `UserMenu`.

| Prop | Type | Notes |
|---|---|---|
| `session` | `ServerSession \| null` | `null` renders the sign-in button |

## States

Signed out, signed in (menu closed / open). Sign out goes through `confirmDiscardIfDirty`, so
an editor with unsaved edits asks first, then signs out and refreshes the server layout.

## Accessibility

- The trigger's accessible name is `Account menu — <name>`; e2e matches `/^Account menu/`.
- Menu items are `menuitem`s; e2e clicks `menuitem` "Sign out".
- The initial is drawn with CSS (`before:content-[attr(data-initial)]`), not a text node, so
  the visible label never mismatches the `aria-label` (WCAG 2.5.3).
- The avatar `img` has empty `alt`; the name beside it is the label.
- Keyboard focus: `focus-visible:ring-2 ring-ring` on the trigger; items use `menuItemRecipe`.

## Do / Don't

- **Do** add dashboard destinations to `menuLinks`, keeping display order.
- **Do** route any action that leaves the page through `confirmDiscardIfDirty`.
- **Don't** render a second Twitch sign-in on `/`.
- **Don't** put the user's initial back into a text node.
