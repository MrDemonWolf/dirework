---
source: apps/web/src/components/confirm-dialog.tsx
tokens: [color.scheme, radius]
---

# Confirm Dialog

## Purpose

The shared destructive-action confirm (audit M7). Every irreversible action (overlay or bot
URL reset, bot disconnect, timer stop/reset, clear all/done tasks, discarding unsaved edits,
resetting messages) routes through it instead of firing silently. Used by `SaveBar`,
`SecretUrlRow`, `UnsavedChangesGuard`, `TaskManager`, `TimerControls`, the styles page and
several bot-settings cards.

## Anatomy

Built on the `AlertDialog` primitive: an optional trigger, then content with a header (title
and description) and a footer holding Cancel (`Button` outline, sm) and Confirm (`Button`
destructive or default, sm). Both footer buttons are `AlertDialogClose`, so either one closes
the dialog.

## Props and variants

| Prop | Type | Default | Notes |
|---|---|---|---|
| `trigger` | `ReactElement` | none | Uncontrolled mode: the element that opens it |
| `open` / `onOpenChange` | `boolean` / `(open) => void` | none | Controlled mode |
| `title` | `string` | required | A question ("Reset the timer overlay URL?") |
| `description` | `ReactNode` | required | What breaks or what is lost |
| `confirmLabel` | `string` | `"Confirm"` | Name the action ("Reset URL", "Discard changes") |
| `cancelLabel` | `string` | `"Cancel"` | |
| `destructive` | `boolean` | `true` | `false` renders a default (primary) Confirm |
| `onConfirm` | `() => void` | required | Runs on Confirm, then the dialog closes |
| `confirmDisabled` | `boolean` | none | Disables Confirm |

## States

Closed; open; open with Confirm disabled (`confirmDisabled`).

## Accessibility

- Renders `role="alertdialog"` named by its title, with the description attached by the
  primitive; e2e waits on `getByRole("alertdialog")`.
- Focus moves into the dialog and returns to the trigger on close; Escape cancels.
- The Confirm label is a verb phrase, so the button name stands alone.

## Do / Don't

- **Do** use it for every irreversible action (an AGENTS.md rule).
- **Do** spell out the consequence in `description`.
- **Don't** confirm reversible actions that already offer Undo (single task removal).
- **Don't** keep the generic "Confirm" label on a destructive action; name what happens.
