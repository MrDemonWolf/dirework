---
source: apps/web/src/components/account-menu.tsx
tokens: [color.scheme, radius]
---

# Account Menu

## Purpose

The signed-in owner's avatar dropdown in the header. It holds what the header nav does not:
the deploy's docs, a way to report a problem, and Sign out. `UserMenu` loads it with
`next/dynamic` (SSR on) and renders it only with a session, so the signed-out pages (`/`,
`/setup`) never download Base UI Menu or floating-ui.

## Anatomy

- Trigger: a round button with the avatar (image, or a CSS-drawn initial on `bg-primary`),
  the name from `sm` up, and a chevron.
- Popup: `DropdownMenuContent` (`w-auto min-w-48`, aligned end, on the shared popup surface), sized to its rows.
  No identity block (the name is already on the trigger).
  1. **Docs**: `BookOpen` icon, opens this deploy's docs (`landingLinks(DOCS_URL).docs`).
  2. **Report a problem**: `Bug` icon, opens the repo's GitHub new-issue form
     (`landingLinks().reportProblem`, built from `REPO_URL`).
  3. Separator.
  4. **Sign out**: `LogOut` icon, a neutral item (signing out deletes nothing).
- Both link rows end in a muted `ExternalLink` icon and are anchors (`DropdownMenuItem`'s
  `render={<a … />}`) with `target="_blank" rel="noopener noreferrer"`.

## Props and variants

Default export `AccountMenu`.

| Prop | Type | Notes |
|---|---|---|
| `session` | `ServerSession` | Never null; `UserMenu` handles the signed-out case |
| `links` | `AccountLinks` | `{ docs, reportProblem }`, built by the `(app)` layout |

## States

Closed / open. Sign out goes through `confirmDiscardIfDirty`, so an editor with unsaved
edits asks first, then loads the auth client on the click (`lib/load-auth-client.ts`; a
failed chunk load after a deploy reloads the page), signs out, and refreshes the server layout.

## Accessibility

- The trigger's accessible name is `Account menu — <name>`; e2e matches `/^Account menu/`.
- Rows are `menuitem`s. The link rows carry an sr-only "(opens in a new tab)", so e2e
  matches `/^Docs/` and `/^Report a problem/`; it clicks `menuitem` "Sign out".
- The initial is drawn with CSS (`before:content-[attr(data-initial)]`), not a text node, so
  the visible label never mismatches the `aria-label` (WCAG 2.5.3).
- Keyboard focus: `focusRing` (`ui/button.tsx`) on the trigger; rows use `menuItemRecipe`.

## Do / Don't

- **Don't** add dashboard destinations here; they belong in the header nav and its phone menu.
- **Don't** make Sign out destructive (red); it ends nothing but the session.
- **Don't** import `@/lib/auth-client` statically; use `loadAuthClient()` in the handler.
- **Don't** put the user's initial back into a text node.
