---
source: apps/web/src/components/bot-settings-skeleton.tsx
tokens: [color.scheme, radius, layout]
---

# Bot Settings Skeleton

## Purpose

Loading placeholders for the Bot settings pages (the heading and sub-nav come from
`dashboard/bot/layout.tsx` and are never skeletons). Two kinds:

- **Card placeholders**, one per progressive card (`BotSection` in `(sections)/bot-data.tsx`,
  the Bot settings form of [progressive-section](./progressive-section.md)). A card shows its
  placeholder only when a query it reads (`config.get`, `user.me`) missed the first-paint
  deadline (`SECTIONS_READY_MS`, `lib/progressive.ts`), and fills in from the same streamed
  batch. Each repeats its live card's frame box for box (measured at 1280px and 412px wide), so
  nothing moves when it fills in.
- **`BotSettingsSkeleton`**, the generic page body shown by `dashboard/bot/loading.tsx` the
  moment a client navigation into Bot settings starts, and by `(sections)/loading.tsx` while a
  sub-page switch renders.

`BotConsoleBodySkeleton` is also used inside the live `BotConsoleCard` while its URL query is
pending, so the card placeholder and the in-card placeholder can't drift.

## Anatomy

- Card placeholders render the real `Card.panel` with the card's real (static) title and
  description, and `Skeleton` blocks for the data: status chips, switches, the description
  lines a row's copy runs to (`TextLines`: one bar per line box, a different count below `sm`
  where copy wraps), URL rows, buttons. Each is wrapped in `SectionPlaceholder`
  (`data-placeholder`, `aria-hidden`).
- The Commands placeholder renders the real, static `CommandTable`s with `aliases={null}`, so
  only the alias cells (and each group's switch and on/off copy) are skeletons.
- `BotSettingsSkeleton`: an `aria-busy` wrapper; two `Card.panel` blocks side by side at `lg`,
  then one full-width panel.

## Props and variants

| Export | Props | Notes |
|---|---|---|
| `LiveControlsPlaceholder` | `hasBotAccount?` (default `true`) | Overview Live controls (`live-controls`); the mute row's copy length depends on the bot account |
| `BotOverviewPlaceholder` | none | The whole Overview while `user.me` streams: live controls + bot account (`bot-account`) beside the console card (`bot-console`), in the connected arrangement |
| `CommandsPlaceholder` | none | Commands (`commands`): both group cards, Always on, Aliases (as with none saved) |
| `RepliesPlaceholder` | none | Replies (`replies`): switcher, filter, the Task set's collapsed groups |
| `BlockedViewersPlaceholder` | none | Moderation Blocked viewers (`blocked-viewers`), empty list |
| `BotSettingsSkeleton` | none | A page body (client navigation only) |
| `BotConsoleBodySkeleton` | none | The console card body only |

## States

Static and data-free. It has no loading, error or empty states of its own.

## Accessibility

Card placeholders are `aria-hidden` (via `SectionPlaceholder`) and hold no focusable element:
the Aliases placeholder's "Replies" is plain text, not a link. `BotSettingsSkeleton` carries
no headings or text a screen reader would announce as content.

## Do / Don't

- **Do** update a card placeholder alongside its card (components/bot-settings/, the pages),
  and re-measure at 1280px and 412px, so a card filling in does not move the page.
- **Do** reuse `BotConsoleBodySkeleton` for any pending state inside the console card.
- **Don't** fetch data; the only input is what the page already knows (`hasBotAccount`).
- **Don't** hand-roll grey boxes; use `Skeleton`.
- **Don't** add an entrance animation: a placeholder only shows when data is slow, and a fade
  would replay per reveal.

## Known exception

Whether a bot account is connected decides the Overview's arrangement (the account card goes
first while none is). While `user.me` streams that is unknown, so `BotOverviewPlaceholder` takes
the connected arrangement; on an instance with no bot account a `user.me` slower than 150ms
moves the cards once when it lands.
