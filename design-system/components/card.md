---
source: apps/web/src/components/ui/card.tsx
tokens: [color.scheme, radius]
---

# Card

## Purpose

Frosted panel container for grouped settings. Used on the bot settings page
(`BotAccountCard`, `BotConsoleCard`, `BlockedViewersCard`, `bot-settings-page.tsx`) and its
skeleton. Replaces the docs-era `dw-card` spec.

## Anatomy

- **Card**: flex column, `rounded-2xl`, `border-border/50`, `bg-card`, `text-card-foreground`,
  `shadow-sm`, `backdrop-blur-xl`, `py-4`, `gap-4`, base text `text-xs/relaxed`. A first-child
  image bleeds to the top edge.
- **CardHeader**: grid, `px-4`; grows a second column when it holds a `CardAction`.
- **CardTitle**: `text-sm font-medium`. **CardDescription**: `text-xs/relaxed text-muted-foreground`.
- **CardAction**: top-right slot beside the title.
- **CardContent**: `px-4`. **CardFooter**: `border-t p-4`, rounded bottom; removes the card's bottom padding.

## Props and variants

| Export | Extra props |
|---|---|
| `Card` | `size?: "default" \| "sm"` (default `"default"`; `sm` = `py-3`, `gap-2`, `px-3` children) |
| `CardTitle` | `as?: "div" \| "h2" \| "h3"` (default `"div"`) |
| `CardHeader`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | `div` props |

## States

Static container; no hover or selected state. Interactive state lives in its children.

## Accessibility

- Use `CardTitle as="h2"` (or `h3`) when the card starts a page section, so the heading
  outline is real; the default `div` is for cards inside an already-titled section.
- Don't make the whole card clickable; put buttons in `CardAction` or `CardFooter`.

## Do / Don't

- **Do** use `size="sm"` for dense nested cards.
- **Do** keep one primary action per card.
- **Don't** nest cards inside cards; use `SectionGroup` or a `ConsoleRule` to divide.
- **Don't** override the radius or blur per call site.
