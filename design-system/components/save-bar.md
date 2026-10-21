---
source: apps/web/src/components/save-bar.tsx
tokens: [color.scheme, layout, z, motion, radius]
---

# Save Bar

## Purpose

Shared sticky "unsaved changes" bar for the Theme Center and bot settings editors. It rises
from the bottom edge while the page is dirty and offers Reset and Save.

## Anatomy

- An always-mounted `sr-only` live region (`role="status"`, `aria-live="polite"`) holding
  the label while visible.
- `SaveBarPanel` (internal, mounted only while visible so its enter animation replays):
  `fixed inset-x-0 bottom-0 z-(--z-save-bar)`, `save-bar-enter` (`console-rise`), hairline
  top border, `bg-background/80` with backdrop blur, safe-area padding, `max-w-content` row.
  - Left: `StatusChip` tone `warn` with the label; an optional `text-destructive` blocked
    reason, rendered as a button when `onBlockedReasonClick` is set.
  - Right: Reset (outline sm, behind a `ConfirmDialog`: "Discard unsaved changes?" /
    "Discard changes") and Save (primary sm, spinner while saving).

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `visible` | `boolean` | required | Usually "is dirty" |
| `saving` | `boolean` | required | Disables both buttons, swaps the Save icon for a spinner |
| `onSave` | `() => void` | required | |
| `onReset` | `() => void` | required | Called after the discard confirm |
| `label` | `string` | `"Unsaved changes"` | Chip text and announcement |
| `blockedReason` | `string \| null` | none | Disables Save and shows why (a field the server would reject) |
| `onBlockedReasonClick` | `() => void` | none | Makes the reason a button that takes the owner to the field at fault (the page switches tab, clears a hiding filter, focuses it) |

## States

Hidden; visible; saving; blocked.

## Accessibility

- Save is named "Save changes" (pinned by e2e); when blocked it has
  `aria-describedby="save-bar-blocked"` pointing at the reason.
- The live region is separate from the bar, because a region full of buttons must not be
  live.
- Reset always confirms (destructive-action rule).

## Do / Don't

- **Do** add bottom padding (`pb-24`) to the page while it is visible so it never covers the
  last field.
- **Do** pass `blockedReason` when the input schema would reject the payload, and
  `onBlockedReasonClick` when the page can jump to the field.
- **Don't** mount two on one page.
- **Don't** bypass the Reset confirm.
