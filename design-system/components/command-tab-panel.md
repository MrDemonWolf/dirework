---
source: apps/web/src/components/bot-settings/command-tab-panel.tsx
tokens: [color.scheme, radius, tracking]
---

# Command Tab Panel

## Purpose

ONE body shared by the Task and Timer command tabs of `/dashboard/bot` (`bot-settings-page.tsx`): a header with the group's enable switch, then the command reference beside the reply editor. Fully controlled: the switch and message edits only update the page draft, which the page's `SaveBar` persists.

## Anatomy

- Header: `h3` title + subtitle; "Enabled" `console-label` + `Switch` (`{idPrefix}-commands-toggle`).
- Info `Callout` "{title} are off" when disabled; it says the replies stay editable and take effect once the group is on.
- Grid at `lg` (`15rem` + editor): `CommandReference` (ordered last on small screens; `lg:sticky lg:top-20` so it stays beside the editor while the reply groups scroll), then `ConsoleRule` (h3) "Messages" and `MessageEditor`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `title` / `subtitle` | `string` | Tab heading copy |
| `idPrefix` | `string` | Prefix for the switch and field ids |
| `enabled` / `onEnabledChange` | `boolean` / `(checked: boolean) => void` | Group switch |
| `commands` | `CommandRow[]` | Legend rows |
| `fields` | `readonly MessageField<...>[]` | From `lib/message-fields.ts` |
| `messages` / `defaults` | `T` | Draft and stock wording |
| `savedMessages` | `T` | Last-saved replies, so a group with an unsaved edit opens itself |
| `invalidKeys` | `ReadonlySet<string>` | Optional; keys the server schema would reject, so their group opens |
| `filter` / `onFilterChange` | `string` / `(filter: string) => void` | Reply filter text, held by the page so the Save bar's link can clear it |
| `onMessagesChange` | `(values: T) => void` | Draft update |
| `preview` | `ReplyPreview` | Speaker + sample vars for the preview line |

Generic over the message object `T`.

## States

- **Enabled**: fields editable.
- **Disabled** (group switched off): fields stay editable, the editor column is dimmed (`opacity-75`, full opacity on hover or focus within), callout shown, legend dimmed with an "Off" chip.

## Accessibility

- The switch label names the control ("Enabled") and never flips to the state.
- Headings nest under the page's h2 card titles (h3 title, h3 "Messages" rule).

## Do / Don't

- **Do** use this for every command-group tab instead of a bespoke layout.
- **Do** keep the header stable so the switch never moves with list length.
- **Don't** save on toggle; the Save bar owns persistence here (unlike mute and block).
- **Don't** hide or lock the editor when the group is off; dim it and say the group is off, so the owner can prepare replies before switching it on.
