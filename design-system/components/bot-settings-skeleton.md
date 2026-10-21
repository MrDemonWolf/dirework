---
source: apps/web/src/components/bot-settings-skeleton.tsx
tokens: [color.scheme, radius, layout]
---

# Bot Settings Skeleton

## Purpose

Loading placeholder for the Bot settings page. Shown by `dashboard/bot/loading.tsx` the
moment a navigation starts, and by `bot-settings-page.tsx` until `config.get` and `user.me`
resolve. `BotConsoleBodySkeleton` is also used inside the live `BotConsoleCard` while its URL
query is pending, so the page skeleton and the in-card placeholder can't drift.

## Anatomy

- Page container: `container max-w-content px-4 py-8`, then a title and subtitle bar.
- Row one (`lg:grid-cols-2`): the console card (`panel-hero`) and the bot account card
  (`panel`), each a `Card` with a hairline-bordered header (eyebrow, title, description).
- Row two: the full-width commands card: a tab-strip bar, then a `15rem` rail beside four
  field blocks.
- Every block is the `Skeleton` primitive.

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `BotSettingsSkeleton` | none | The full page |
| `BotConsoleBodySkeleton` | none | The console card body only (four bars) |

## States

Static and data-free. It has no loading, error or empty states of its own.

## Accessibility

Decorative placeholders. It carries no headings or text a screen reader would announce as
content.

## Do / Don't

- **Do** update it alongside `bot-settings-page.tsx` so the layout doesn't jump when data
  lands (same grid, same card order, roughly the same heights).
- **Do** reuse `BotConsoleBodySkeleton` for any pending state inside the console card.
- **Don't** fetch data or accept props.
- **Don't** hand-roll grey boxes; use `Skeleton`.
