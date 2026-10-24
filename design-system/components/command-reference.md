---
source: apps/web/src/components/bot-settings/command-reference.tsx
tokens: [color.scheme, font.size, radius, tracking]
---

# Command Reference

## Purpose

Read-only command legend on the Bot settings Moderation page (`BlockedViewersCard`: "Mod commands in chat"). The Commands page uses `CommandTable` instead. Rows come from `lib/command-rows.ts` (shared with the viewer landing page); `command-rows.test.ts` pins them to the bot's real parser in `@dirework/api/chat-commands`.

## Anatomy

- Flush `SectionGroup` "Command reference", open by default, trailing a `CountBadge` (plus an "Off" chip when disabled).
- Hairline-divided list: mono command, description, optional "Mods" chip, then a mono `text-2xs` usage line.
- Footnote "Mods = moderators and the streamer." when any row is mod-only.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `commands` | `CommandRow[]` | | Rows to list |
| `disabled` | `boolean` | `false` | Dims rows (`opacity-60`) and adds an `idle` "Off" chip |
| `className` | `string` | | Layout order in the parent grid |

## States

- **Enabled** / **Disabled** (group switched off): visible where the commands are listed, not only at the switch.
- Collapsed / expanded via `SectionGroup`.

## Accessibility

- The list is `aria-labelledby` the section title (`useId`).
- The "Mods" permission is text, not color alone.

## Do / Don't

- **Do** add commands to `lib/command-rows.ts`, never inline here.
- **Do** keep it read-only.
- **Don't** hide disabled commands; dim them.
- **Don't** fork a second legend for another page; pass different rows.
