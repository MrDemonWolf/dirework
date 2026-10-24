---
source: apps/web/src/components/bot-settings-skeleton.tsx
tokens: [color.scheme, radius, layout]
---

# Bot Settings Skeleton

## Purpose

Loading placeholder for a Bot settings page body (the heading and sub-nav come from
`dashboard/bot/layout.tsx` and are never skeletons). Shown by `dashboard/bot/loading.tsx` the
moment a navigation into Bot settings starts, by `(sections)/loading.tsx` while a sub-page
switch renders, and by the data gate (`(sections)/bot-data.tsx`) until `config.get` and
`user.me` resolve. `BotConsoleBodySkeleton` is also used inside the live `BotConsoleCard` while its URL
query is pending, so the page skeleton and the in-card placeholder can't drift.

## Anatomy

- `aria-busy` wrapper. Row one (`lg:grid-cols-2`): two `Card.panel` blocks, each a
  hairline-bordered header (title, description) over four body bars — the Overview's Live
  controls and Run the bot cards.
- Row two: one more full-width panel.
- Every block is the `Skeleton` primitive.

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `BotSettingsSkeleton` | none | A page body |
| `BotConsoleBodySkeleton` | none | The console card body only (four bars) |

## States

Static and data-free. It has no loading, error or empty states of its own.

## Accessibility

Decorative placeholders. It carries no headings or text a screen reader would announce as
content.

## Do / Don't

- **Do** update it alongside the Overview (`(sections)/overview-page.tsx`) so the layout doesn't jump when data
  lands (same grid, same card order, roughly the same heights).
- **Do** reuse `BotConsoleBodySkeleton` for any pending state inside the console card.
- **Don't** fetch data or accept props.
- **Don't** hand-roll grey boxes; use `Skeleton`.
