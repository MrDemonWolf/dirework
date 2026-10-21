---
source: apps/web/src/components/bot-settings/command-tab-panel.tsx
tokens: [color.scheme, radius, tracking]
---

# Command Tab Panel

## Purpose

ONE body shared by the Task and Timer command tabs of `/dashboard/bot` (`bot-settings-page.tsx`): a header with the group's enable switch, then the command reference beside the reply editor. Fully controlled: the switch and message edits only update the page draft, which the page's `SaveBar` persists.

## Anatomy

- Header: `h3` title + subtitle; "Enabled" `console-label` + `Switch` (`{idPrefix}-commands-toggle`).
- Info `Callout` "{title} are off" when disabled.
- Grid at `lg` (`15rem` + editor): `CommandReference` (ordered last on small screens), then `ConsoleRule` (h3) "Messages" and `MessageEditor`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `title` / `subtitle` | `string` | Tab heading copy |
| `idPrefix` | `string` | Prefix for the switch and field ids |
| `enabled` / `onEnabledChange` | `boolean` / `(checked: boolean) => void` | Group switch |
| `commands` | `CommandRow[]` | Legend rows |
| `fields` | `readonly MessageField<...>[]` | From `lib/message-fields.ts` |
| `messages` / `defaults` | `T` | Draft and stock wording |
| `onMessagesChange` | `(values: T) => void` | Draft update |
| `preview` | `ReplyPreview` | Speaker + sample vars for the preview line |

Generic over the message object `T`.

## States

- **Enabled**: fields editable.
- **Disabled**: message fields disabled, callout shown, legend dimmed with an "Off" chip.

## Accessibility

- The switch label names the control ("Enabled") and never flips to the state.
- Headings nest under the page's h2 card titles (h3 title, h3 "Messages" rule).

## Do / Don't

- **Do** use this for every command-group tab instead of a bespoke layout.
- **Do** keep the header stable so the switch never moves with list length.
- **Don't** save on toggle; the Save bar owns persistence here (unlike mute and block).
- **Don't** hide the editor when disabled; say why it is locked.
