---
source: apps/web/src/components/header.tsx
tokens: [color.scheme, radius, layout, z, motion]
---

# Header

## Purpose

Sticky top bar for the `(app)` route group, rendered by `app/(app)/layout.tsx`: logo, the
dashboard nav (desktop links plus a mobile dropdown), the theme toggle and the account menu.
The nav is in the server HTML (it reads the layout's server session), not added after a
client fetch. It is navigation, not access control: pages call `requireSession()` and the
API's `ownerProcedure` authorizes.

## Anatomy

- `<header>`: `sticky top-0 z-(--z-header)`, hairline bottom border, `bg-background/60` with
  backdrop blur, padded by the safe-area insets.
- Inner row: `h-header max-w-content`.
- Left: logo link (inline SVG titled "DireWork logo" + wordmark) and, when signed in, the
  desktop `<nav>` (`md:flex`): Dashboard, Theme Center, Bot. Each icon pulses
  (`animate-led-pulse`) while its navigation is pending (`useLinkStatus`).
- Right: `ModeToggle`, `UserMenu`, and, when signed in, the mobile hamburger (`md:hidden`,
  ghost icon `Button` with an enlarged `::after` touch target).
- Mobile dropdown: `<nav id="mobile-nav" aria-label="Mobile">`, rows `min-h-11`, entering with
  `save-bar-enter`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `session` | `ServerSession \| null` | Null hides the nav and the hamburger; `UserMenu` then shows sign-in |

Default export `Header`. Nav items are the internal `navItems` list (typed routes).

## States

- Signed out / signed in.
- Active link: `bg-primary/10 text-primary` and `aria-current="page"` (`/dashboard` matches
  exactly; the others match by prefix). Inactive: muted, `hover:bg-accent/40`.
- Mobile menu open / closed; a route change closes it during render.

## Accessibility

- Landmark `banner` (e2e: `getByRole("banner")`).
- Hamburger is named "Open menu" / "Close menu" with `aria-expanded` and
  `aria-controls="mobile-nav"` (pinned by e2e).
- Escape closes the menu (never mid-IME composition) and returns focus to the hamburger.
- Links use the standalone focus recipe (`focus-visible:ring-2 ring-ring`).
- Link names "Theme Center" etc. are pinned by e2e.

## Do / Don't

- **Do** add sections to `navItems` so desktop and mobile stay in sync.
- **Do** keep the z-index on the `--z-header` token.
- **Don't** gate access on the nav's visibility.
- **Don't** fetch the session client-side here; it comes from the layout.
