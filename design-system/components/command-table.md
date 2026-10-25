---
source: apps/web/src/components/bot-settings/command-table.tsx
tokens: [color.scheme, radius]
---

# Command Table

## Purpose

Read-only table of chat commands on the Bot settings Commands page (`/dashboard/bot/commands`): what to type, who may type it, and the aliases that also run it. One table per command group (Task, Timer) and one for the always-on meta commands. Rows come from `lib/command-rows.ts`; aliases come from the alias editor's draft (`rowsToAliases` → `aliasesByTarget`), so a new alias appears beside its command while it is typed.

## Anatomy

- `<table>` with a visually hidden `<caption>` and a hairline-ruled header: Command · Usage · Who · Aliases.
- Each row: a row header with the command (mono) and its description; the usage line (mono, muted; omitted when it only repeats the command); a small `StatusChip` "Mods" (`alt`) or "Everyone" (`idle`); the aliases as mono pills written as viewers type them (`!pomo start` for an alias of `!timer`), or a dash.
- Below `sm` the Usage column is hidden and the usage line moves under the command, so the table never scrolls sideways.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `caption` | `string` | Screen-reader name of the table |
| `commands` | `readonly CommandRow[]` | From `lib/command-rows.ts` |
| `aliases` | `ReadonlyMap<string, string[]> \| null` | Canonical aliases by target (`aliasesByTarget`); `null` while the config streams (the Commands placeholder), each alias cell then a `Skeleton` |
| `disabled` | `boolean` | Optional; dims the rows (`opacity-60`) when the group is switched off |

## States

- **Group off**: dimmed, still readable; the card's description says what off means.
- **No aliases**: a dash, read as "None".
- **Config still streaming** (`aliases={null}`, the Commands page placeholder only): each alias
  cell is a dash-sized `Skeleton`; the static rows render as usual.
- **Invalid alias in the draft**: not shown (only what the server would accept appears).

## Accessibility

- Real table semantics: `<caption>`, `scope="col"` headers, a `scope="row"` header per command.
- The dash is `aria-hidden` with an sr-only "None"; the dimming transition is off under `prefers-reduced-motion`.

## Do / Don't

- **Do** feed it the draft's aliases, so the table and the editor never disagree.
- **Do** keep the always-on commands in their own table that no switch dims.
- **Don't** make it editable; aliases are edited in `CommandAliasEditor`.
- **Don't** add per-row switches; a group switches as a whole.
