---
source: apps/web/src/components/bot-settings/settings-card.tsx
tokens: [color.scheme, radius, font.family, tracking]
---

# Settings Card

## Purpose

The one card frame every Bot settings card shares (`/dashboard/bot/*`): the eight live cards
(Live controls, Bot account, Run the bot, the two command groups, Always on, Aliases, Replies,
Blocked viewers) and their progressive placeholders in
[bot-settings-skeleton](./bot-settings-skeleton.md). One place for the padding, the header rule
and the title type, so a placeholder keeps repeating its live card box for box.

## Anatomy

- [card](./card.md) with `.panel` (`SETTINGS_CARD_CLASS`).
- `CardHeader` with the hairline rule and `px-5` (`SETTINGS_CARD_HEADER_CLASS`): `CardTitle` as
  an `h2` in `PANEL_TITLE_CLASS` (`lib/panel-header.ts`, the dashboard panels' title), then the
  optional `CardAction` (`flex items-center`, top right), then `CardDescription`.
- `CardContent` with `px-5` (`SETTINGS_CARD_CONTENT_CLASS`) plus the card's own spacing.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `title` | `string` | The `h2` text |
| `description` | `ReactNode` | Under the title; may hold links or a second line |
| `action` | `ReactNode?` | Status chip or the group switch, top right |
| `contentClassName` | `string?` | Body spacing (`space-y-4`, `space-y-5`); none by default |
| `children` | `ReactNode` | The body |

The three class constants are exported for `PanelSkeleton` (`BotSettingsSkeleton`), which shares
the frame but must not render a heading.

## States

None of its own; the card inside decides (pending, error, empty).

## Accessibility

- The title is a real `h2`, so each card is a landmark in the page's heading outline under the
  Bot settings `h1`.
- An action control is named by the title (the command-group switch has an `sr-only` label);
  the action sits before the description in the DOM.

## Do / Don't

- **Do** render every Bot settings card, live or placeholder, through `SettingsCard`
  (`bot-settings-layout.test.ts` pins it).
- **Do** change the frame here, never per card.
- **Don't** put a `Skeleton` in `title`: a placeholder shows the real static title, and the
  page-body skeleton uses the exported classes with no heading.
- **Don't** retype the title classes; use `PANEL_TITLE_CLASS`.
