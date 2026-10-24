---
source: apps/web/src/components/bot-settings/command-alias-editor.tsx
tokens: [color.scheme, radius, tracking]
---

# Command Alias Editor

## Purpose

The Aliases tab of `/dashboard/bot/commands` (`(sections)/commands/commands-page.tsx`): an editable list of alias to command rows. Rows hold raw input (`AliasRow` from `lib/alias-rows.ts`); the page converts them to the canonical, `!`-less map on save via `rowsToAliases`, which also drops fully blank rows.

## Anatomy

- Header: "Command aliases" title + hint, outline small "Add alias" button.
- One row per alias: "Alias" input (mono, placeholder `!t`), "Command" input (mono, `!task`), ghost destructive trash icon button; an inline error line under a rejected row.
- Empty line ("No aliases yet…") and a summary alert when any row is rejected.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `rows` | `AliasRow[]` | | Controlled |
| `onChange` | `(rows: AliasRow[]) => void` | | Emits the whole list |
| `maxRows` | `number` | `50` | Mirrors the server `commandAliasesInput` cap |

Inputs cap at `maxLength` 50 (alias) / 100 (command). Either `!t` or `t` is accepted.

## States

- Validated every render with the shared validator (`rowsToAliases(...).issues`, the one the server runs). Each reason (`empty`, `multi-word`, `shadows-builtin`, `duplicate`, `recursive`, `unknown-target`) has fixed copy and marks the field at fault (`border-destructive`, `aria-invalid`).
- "Add alias" disabled at `maxRows`.

## Accessibility

- Each input has a visible label (`{rowId}-key` / `{rowId}-cmd`) and is `aria-describedby` the row error.
- Remove buttons are named `Remove alias {key}` (or `(empty)`).
- The summary "Fix the highlighted aliases before saving." is `role="alert"`.

## Do / Don't

- **Do** reuse `normalizeAliasToken` / `rowsToAliases`; never re-implement alias rules here.
- **Do** point an error at the specific field that caused it.
- **Don't** store aliases with a leading `!`.
- **Don't** confirm row removal; nothing persists until Save.
