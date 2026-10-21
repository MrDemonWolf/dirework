---
source: apps/web/src/components/ui/collapsible.tsx
tokens: []
---

# Collapsible

## Purpose

Unstyled Base UI `Collapsible` with `data-slot` hooks. Its only consumer is `SectionGroup`
(`section-group.tsx`), which supplies the visual treatment for the Theme Center and bot
settings disclosure groups.

## Anatomy

- `Collapsible` (root): holds the open state.
- `CollapsibleTrigger`: the button that toggles it.
- `CollapsibleContent`: the panel (`Collapsible.Panel`).

No classes of its own; each part carries `data-slot="collapsible*"` for styling.

## Props and variants

| Export | Wraps | Key props |
|---|---|---|
| `Collapsible` | `Collapsible.Root` | `open`, `defaultOpen`, `onOpenChange`, `disabled` |
| `CollapsibleTrigger` | `Collapsible.Trigger` | `render` to swap the element |
| `CollapsibleContent` | `Collapsible.Panel` | `keepMounted`, `hiddenUntilFound` |

No variants.

## States

Open / closed (`data-open` / `data-closed` on trigger and panel); panel transitions use
`data-starting-style` / `data-ending-style` when the caller styles them.

## Accessibility

- The trigger is a `<button>` with `aria-expanded` and `aria-controls` pointing at the panel.
- Enter and Space toggle. Content in a closed panel leaves the tab order.

## Do / Don't

- **Do** reach for `SectionGroup` first; use these parts directly only for a new disclosure pattern.
- **Do** keep the trigger's visible text descriptive (it is the accessible name).
- **Don't** hide required form fields in a collapsed panel without a visible error path.
