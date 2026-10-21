---
source: apps/web/src/components/section-group.tsx
tokens: [color.scheme, radius, tracking]
---

# Section Group

## Purpose

The collapsible recessed section every Theme Center editor and the Bot settings page are
built from. One implementation, so the trigger styling and chevron rotation never drift.
Used by `timer-style-editor`, `task-style-editor`, `phase-labels-editor`,
`bot-console-card`, `blocked-viewers-card` and `command-reference`.

## Anatomy

- Root: Base UI `Collapsible` with the `panel-inset` well (recessed surface, hairline edge).
- Trigger row: optional `icon`, the title in `console-label` (mono, uppercase, `tracking-label`),
  then the `trailing` slot and a `ChevronDown` that rotates 180deg when open.
- Panel: `space-y-3 px-4 pt-1.5 pb-4`, or a bare `border-t` wrapper when `flush`.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `ReactNode` | required | Header text |
| `titleId` | `string` | none | id on the title so a list inside can use `aria-labelledby` |
| `icon` | `ReactNode` | none | Leading icon |
| `trailing` | `ReactNode` | none | Right edge, before the chevron (a count, a status chip) |
| `defaultOpen` | `boolean` | `true` | Uncontrolled initial state |
| `flush` | `boolean` | `false` | No body padding, for lists that draw their own rows |
| `className` | `string` | none | Merged onto the root |
| `children` | `ReactNode` | required | Panel content |

## States

- Open / closed (`data-panel-open` drives the chevron rotation).
- Hover: the trigger fills `bg-muted/40` and the title brightens to `text-foreground`.
- Focus: keyboard-only `focus-visible:ring-2 ring-ring`.

## Accessibility

- The trigger is a real button from Base UI with `aria-expanded` and `aria-controls`.
- The chevron is `aria-hidden`; the title text is the accessible name.
- Use `titleId` when the body is a list that needs a group label.

## Do / Don't

- **Do** use it for every collapsible editor section instead of hand-rolling a Collapsible.
- **Do** put counts and status chips in `trailing`, not in `title`.
- **Don't** nest interactive controls inside `title`; the whole row is the toggle button.
- **Don't** use `flush` unless the children draw their own padding and dividers.
