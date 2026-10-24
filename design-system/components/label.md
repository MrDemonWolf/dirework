---
source: apps/web/src/components/ui/label.tsx
tokens: []
---

# Label

## Purpose

Form label primitive. Used by `FieldRow` and `PhaseLabelsEditor` (Theme Center),
`TimerControls`, and the bot settings forms (`MessageEditor`, `CommandAliasEditor`,
`CommandTabPanel`, `BotLiveControls`, `BlockedViewersCard`).

## Anatomy

- Native `<label>`, `flex items-center gap-2`, `text-xs leading-none`, `select-none`.
- Inherits color from its parent (no color token of its own).

## Props and variants

All native `<label>` props (`React.ComponentProps<"label">`); pass `htmlFor`, or wrap the
control. `className` merges. No variants.

## States

- Dims to 50% when a sibling `peer` control is disabled (`peer-disabled:`), or when inside a
  `group` with `data-disabled="true"` (also drops pointer events).

## Accessibility

- It is the control's accessible name: always tie it with `htmlFor` or by wrapping. The
  biome a11y rule is suppressed in the primitive only because callers supply the association.
- Clicking the label focuses or toggles the control, which widens the hit area on touch.

## Do / Don't

- **Do** write labels as nouns ("Work length"), not instructions.
- **Do** put the `Switch` before its `Label` in DOM order when relying on `peer-disabled`.
- **Don't** use a `Label` as a heading or caption for non-form content.
- **Don't** add a second hidden `aria-label` that disagrees with the visible label.
