---
source: apps/web/src/components/ui/button.tsx
tokens: [color.scheme, radius]
---

# Button

## Purpose

The app's only button primitive (Base UI `Button` + `cva`). Used by nearly every surface:
dashboard, Theme Center, bot settings, header, setup and sign-in screens, `ConfirmDialog`,
`SaveBar`, `SecretUrlRow`, `QueryError`. Replaces the docs-era `dw-btn` spec (the `dw-btn`
classes still exist on the docs site only; see design-system.mdx).

## Anatomy

- Inline-flex, centered, `rounded-lg` (compact sizes `rounded-md`), transparent 1px border,
  `font-medium`, `text-base` on touch / `md:text-sm`.
- Icons: unsized `svg` children get `size-4` (`size-3` / `size-3.5` on `xs` / `sm`); mark an icon
  `data-icon="inline-start"` or `"inline-end"` to tighten the padding on that side.

## Props and variants

Props: everything from Base UI `Button.Props` plus `variant` and `size`. `buttonVariants` is
exported for links styled as buttons (`<Link className={buttonVariants(...)}>`).

| `variant` | Look | Use |
|---|---|---|
| `default` (default) | `bg-primary`, `text-primary-foreground` | Primary action on the surface |
| `outline` | `bg-background`, `border-border` (input tint in dark) | Secondary action |
| `secondary` | `bg-secondary` | Low-emphasis filled |
| `ghost` | No fill until hover (`bg-muted`) | Toolbars, icon buttons, menus |
| `destructive` | `bg-destructive/10`, `text-destructive` | Remove / reset / disconnect |
| `link` | `text-primary`, underline on hover | Inline text action |

| `size` | Box | Touch minimum (`pointer-coarse`) |
|---|---|---|
| `default` (default) | `h-8` | 44px |
| `xs` | `h-6` | 36px |
| `sm` | `h-7` | 40px |
| `lg` | `h-9` | 44px |
| `icon` / `icon-xs` / `icon-sm` / `icon-lg` | square 32 / 24 / 28 / 36px | 44 / 36 / 40 / 44px |

## States

Hover (per variant), `aria-expanded` (menu triggers keep the hover fill while open),
`aria-invalid` (destructive ring and border), disabled / `data-disabled` (50% opacity,
`cursor-not-allowed`), focus-visible.

## Accessibility

- Always a real `<button>` (or `render` into a link), never a clickable `div`.
- Focus-visible draws `ring-1 ring-ring/50` plus a ring-colored border (still its own recipe;
  see README "Focus").
- Icon-only sizes need an `aria-label`. e2e pins names such as "Add", "Start", "Stop timer",
  "Save changes", "Reset to default", "Undo", "Open menu" / "Close menu", "Sign in with Twitch",
  "Claim with Twitch", "Reset Timer overlay URL" and "Show <label> URL".

## Do / Don't

- **Do** use one `default` button per surface; the rest `outline` or `ghost`.
- **Do** use `destructive` and route it through `ConfirmDialog`.
- **Don't** hand-roll button classes or recolor with arbitrary values; add a variant instead.
- **Don't** add Twitch purple as a variant: the Twitch buttons apply `bg-twitch` via `className` at their call site.
