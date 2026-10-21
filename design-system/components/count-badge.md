---
source: apps/web/src/components/count-badge.tsx
tokens: [color.scheme, radius, font.family, font.size]
---

# Count Badge

## Purpose

Small mono count pill for section headers and rules: how many items sit below. Used by
`bot-settings/command-reference.tsx`, `bot-settings/blocked-viewers-card.tsx` and
`bot-settings/message-editor.tsx`, usually as a `ConsoleRule` or `SectionGroup` child.

## Anatomy

A `span`: `rounded-full bg-muted px-1.5`, IBM Plex Mono at `text-3xs` (10px), tabular
numerals, `text-muted-foreground`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `count` | `number` | Rendered as-is |
| `className` | `string` | Merged with `cn` |

No variants.

## States

None. A count of `0` still renders; hide it at the call site if zero should be silent.

## Accessibility

The bare number has no label of its own. Place it beside the text it counts (inside the
heading or rule) so it reads as "Blocked viewers 3"; add `sr-only` context at the call site
when the meaning isn't obvious.

## Do / Don't

- **Do** use it for neutral counts beside a label.
- **Don't** use it for state (live, paused, error); that is `StatusChip`.
- **Don't** make it interactive.
