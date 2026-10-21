---
source: apps/web/src/components/bot-settings/message-editor.tsx
tokens: [color.scheme, radius, tracking]
---

# Message Editor

## Purpose

ONE generic chat reply-template editor for both the task and timer message sets (rendered by `CommandTabPanel`). Field lists live in `lib/message-fields.ts`. Edits only touch the page draft; nothing persists until the Save bar.

## Anatomy

- Toolbar: search input ("Filter N messages…") with a search icon, and a ghost "Reset all" button behind `ConfirmDialog`.
- One `SectionGroup` per field group, with a `CountBadge` in `trailing`. Groups are closed by default; a group opens itself while it holds an invalid field (and can't be closed then, since Save is blocked on it), while the filter has text, and, until the owner toggles it, while it holds an unsaved edit (differs from `saved`).
- Per field: label + "Reset to default" (only when the value differs from `defaults`), input, `ByteBudget`, a preview line (`{speaker}: {reply}`), and variable chips (`{user}`, `{task}`, …) with tooltips.
- Empty-filter line `No messages match "…"`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `fields` | `readonly MessageField<Extract<keyof T, string>>[]` | Label, key, group, variables |
| `idPrefix` | `string` | Input id = `{idPrefix}-{key}` |
| `values` / `defaults` | `T` | Draft and stock wording |
| `saved` | `T` | Last-saved values; a group holding a field that differs opens itself |
| `invalidKeys` | `ReadonlySet<string>` | Optional; keys the server schema would reject besides the byte budget |
| `filter` / `onFilterChange` | `string` / `(filter: string) => void` | Filter text, held by the page (one per tab) so the Save bar's link can clear a filter hiding the field at fault |
| `onChange` | `(values: T) => void` | Emits the whole object |
| `preview` | `ReplyPreview` | Exported type: `{ speaker: string; vars: Record<string, string> }` |

## States

- **Customized**: per-field reset shown; "Reset all" enabled.
- **Near limit / over**: `ByteBudget` shows the UTF-8 budget (`messageBudget`, capped at `MAX_MESSAGE_TEMPLATE_BYTES`); typing past the cap is allowed and marked `aria-invalid`; a chip insert that would overflow is refused.
- **Empty value**: preview shows "(empty)".
- **Collapsed / expanded**: per the open rule under Anatomy.

## Accessibility

- Inputs are labelled by the field label; e2e pins `getByLabel("Task added")`, the preview text rendered by the bot's own `interpolate`, and the "Reset to default" button (gone once the value matches stock).
- Inputs are `aria-describedby` the preview (prefixed with sr-only "Preview:") and, near the cap, the byte budget.
- Chips are real buttons named `Insert {token}`; inserting refocuses the input with the caret after the token. On coarse pointers they are at least 44px (`pointer-coarse:min-h-11 min-w-11`).
- Filter input `aria-label="Filter messages"`; each group is a `SectionGroup` disclosure (a real button with `aria-expanded`).
- "Reset all" confirms ("Reset every message to its default?").

## Do / Don't

- **Do** preview with `interpolate` + `previewVarsFor`, so byte fitting matches what chat gets.
- **Do** bound templates in UTF-8 bytes, never characters.
- **Don't** build a second editor for another message set; pass new `fields`.
- **Don't** persist from here; reset and edit are draft-only.
- **Don't** lock the fields when the group is switched off; the tab dims them instead (see command-tab-panel).
