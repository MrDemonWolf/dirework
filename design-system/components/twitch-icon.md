---
source: apps/web/src/components/icons/twitch-icon.tsx
tokens: []
---

# Twitch Icon

## Purpose

The Twitch glyph shared by every "Sign in / Connect with Twitch" button: `user-menu`,
`owner-sign-in`, `setup-content` and `bot-account-card`. lucide 1.x dropped brand icons, so
brand glyphs live as inline SVG components.

## Anatomy

A 24x24 `viewBox` SVG with `fill="currentColor"`, so it takes the button's text color.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `className` | `string` | none | Size it with `size-*` |

## States

None.

## Accessibility

`aria-hidden`; the button's text ("Sign in", "Sign in with Twitch", "Claim with Twitch") is
the accessible name. The `<title>` is for tooling only.

## Do / Don't

- **Do** pair it with visible text on a `bg-twitch` button.
- **Don't** use it as the only content of a control without an `aria-label`.
- **Don't** use Twitch purple or this glyph outside Twitch actions.
