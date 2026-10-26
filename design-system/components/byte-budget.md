---
source: apps/web/src/components/byte-budget.tsx
tokens: [color.scheme, font.family]
---

# Byte Budget

## Purpose

Used-of-cap readout under a capped text input. Chat text is bounded in UTF-8 bytes, not
characters (an IRC line caps at 512 bytes), so the reply editors count bytes; phase
labels count user-perceived characters and bytes (whichever is tighter); alias inputs
count characters. Shown once a value reaches 80% of its cap. Used by
`bot-settings/message-editor.tsx`, `bot-settings/command-alias-editor.tsx` and
`theme-center/phase-labels-editor.tsx`.

## Anatomy

A single right-aligned `<p>` in mono with tabular numerals: `{used}/{max} {unit}`, plus
` — too long to save` when over the cap.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | Element id; the input points at it via `aria-describedby` |
| `budget` | `MessageBudget` (`@/lib/message-budget`) | `{ used, max, unit, nearLimit, over }` |

Tone follows `budget.over`: `text-destructive` when over, otherwise `text-muted-foreground`.

## States

- **Comfortably under:** renders nothing (`nearLimit` is false).
- **Near the limit:** muted count.
- **Over:** destructive count with the "too long to save" suffix.

## Accessibility

- `aria-live="polite"`, so the count is announced as it changes.
- While it is visible the input sets `aria-describedby={id}`, and `aria-invalid` when
  `budget.over`. The state is not color-only: the suffix spells out the problem.

## Do / Don't

- **Do** compute `budget` with the shared helpers (`messageBudget`, `phaseLabelBudget` in
  `lib/message-budget.ts`, `aliasBudget` in `lib/alias-rows.ts`), which read the same caps
  as the server schemas.
- **Do** block Save (`SaveBar`'s `blockedReason`) while any budget is over.
- **Don't** count chat text in characters (`.length`); emoji and accents take several bytes.
- **Don't** leave `aria-describedby` pointing at the id while it renders nothing.
