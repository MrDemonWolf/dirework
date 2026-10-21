---
source: apps/web/src/components/section-group.tsx
tokens: [color.scheme, radius, tracking]
---

# Section Group

## Purpose

The collapsible recessed section every Theme Center editor and the Bot settings page are
built from, and the dashboard's "Edit session settings" disclosure. One implementation, so
the trigger styling and chevron rotation never drift. Used by `timer-style-editor`,
`task-style-editor`, `phase-labels-editor`, `bot-console-card`, `blocked-viewers-card`,
`command-reference` and `timer-controls` (`TimerSettings`).

## Anatomy

- Root: Base UI `Collapsible` with the `panel-inset` well (recessed surface, hairline edge).
- Header row: the trigger, then the optional `menu` beside it (`pr-1.5`), outside the trigger.
- Trigger: optional `icon`, the title in `console-label` (mono, uppercase, `tracking-label`)
  with the optional `summary` under it (`font-mono text-xs tabular-nums`, hidden while open),
  then the `trailing` slot and a `ChevronDown` that rotates 180deg when open.
- Panel: `space-y-3 px-4 pt-1.5 pb-4`, or a bare `border-t` wrapper when `flush`.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `ReactNode` | required | Header text |
| `titleId` | `string` | none | id on the title so a list inside can use `aria-labelledby` |
| `icon` | `ReactNode` | none | Leading icon |
| `trailing` | `ReactNode` | none | Right edge, before the chevron (a count, a status chip); display-only |
| `menu` | `ReactNode` | none | Actions beside the header (a dropdown menu), outside the toggle button |
| `summary` | `ReactNode` | none | One-line digest under the title, shown only while collapsed |
| `defaultOpen` | `boolean` | `true` | Uncontrolled initial state |
| `flush` | `boolean` | `false` | No body padding, for lists that draw their own rows |
| `className` | `string` | none | Merged onto the root |
| `children` | `ReactNode` | required | Panel content |

## States

- Open / closed (`data-panel-open` drives the chevron rotation and hides the `summary`).
- Hover: the trigger fills `bg-muted/40` and the title brightens to `text-foreground`.
- Focus: keyboard-only `focus-visible:ring-2 ring-ring`.

## Accessibility

- The trigger is a real button from Base UI with `aria-expanded` and `aria-controls`.
- The chevron is `aria-hidden`; the title text is the accessible name, plus the `summary`
  while it shows (it sits inside the button), so tests match the title by regex.
- `menu` renders outside the trigger because a button can't hold another one.
- Use `titleId` when the body is a list that needs a group label.

## Do / Don't

- **Do** use it for every collapsible editor section instead of hand-rolling a Collapsible.
- **Do** put counts and status chips in `trailing`, not in `title`, and actions in `menu`.
- **Do** keep `summary` to one short line of text; it is read as part of the trigger's name.
- **Don't** nest interactive controls inside `title`, `summary` or `trailing`; the whole row
  is the toggle button.
- **Don't** use `flush` unless the children draw their own padding and dividers.
