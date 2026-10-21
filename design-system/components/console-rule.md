---
source: apps/web/src/components/console-rule.tsx
tokens: [color.scheme, font.family, tracking]
---

# Console Rule

## Purpose

The "Focus Console" section header: a mono uppercase label followed by a hairline that fills
the row. It replaced about fifteen copy-pasted variants. Used across the dashboard, Theme
Center, bot settings cards, `TaskManager`, `TimerControls` and `StylePreviewPanel`.

## Anatomy

- Wrapper `div.console-rule`: flex row with a `0.75rem` gap; its `::after` is a 1px
  `--border` line that fills the rest of the row.
- Label element `.console-label`: IBM Plex Mono, 0.75rem, weight 500, `0.12em` tracking,
  uppercase, `--muted-foreground`.
- Optional `children` render after the label, before the rule (a size chip, a count badge).

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | `ReactNode` | required | |
| `as` | `"span" \| "h2" \| "h3"` | `"span"` | Use a heading when the label is a real section heading |
| `id` | `string` | none | Set on the label element, for `aria-labelledby` |
| `className` | `string` | none | Merged onto the wrapper |
| `children` | `ReactNode` | none | Trailing chips or badges |

## States

None.

## Accessibility

- As a `span` it is decoration; as `h2`/`h3` it joins the page outline. Pick the level that
  fits the surrounding headings (`h3` under a section `h2`).
- Pair `id` with `aria-labelledby` on the section it heads.

## Do / Don't

- **Do** use it for every labeled hairline divider instead of re-creating the classes.
- **Do** pass `as="h2"` where the label names a page section.
- **Don't** put long sentences in it; it is a short label.
- **Don't** add outer margins inside the component; space it from the caller.
