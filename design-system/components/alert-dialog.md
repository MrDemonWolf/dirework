---
source: apps/web/src/components/ui/alert-dialog.tsx
tokens: [color.scheme, radius]
---

# Alert Dialog

## Purpose

Base UI `AlertDialog` wrapped in the Focus Console chrome. It is the modal behind every
destructive confirmation; app code reaches it through `ConfirmDialog`
(`confirm-dialog.tsx`), its only direct importer.

## Anatomy

- **Backdrop**: fixed full-screen `bg-black/55` with a 2px backdrop blur; fades in and out.
- **Content**: portaled popup centered on screen, `bg-popover` / `text-popover-foreground`,
  `rounded-xl` border, `p-5`, `shadow-2xl`, max width `sm:max-w-md` (full width minus 2rem on
  phones). Enters with opacity, scale 95% and a 6px rise.
- **Header**: column, `gap-1.5`, left aligned. **Title** `font-heading text-base font-semibold`.
  **Description** `text-sm/relaxed text-muted-foreground`.
- **Footer**: buttons stack reversed on phones (primary on top), right-aligned row from `sm`.

## Props and variants

| Export | Wraps | Notes |
|---|---|---|
| `AlertDialog` | `AlertDialog.Root` | `open`, `onOpenChange`, `defaultOpen` |
| `AlertDialogTrigger` | `Trigger` | Usually `render={<Button />}` |
| `AlertDialogPortal` | `Portal` | Used internally by `AlertDialogContent` |
| `AlertDialogBackdrop` | `Backdrop` | Rendered by `AlertDialogContent` |
| `AlertDialogContent` | `Popup` | Portal and backdrop included; `className` merges |
| `AlertDialogHeader` / `AlertDialogFooter` | `div` | Layout only |
| `AlertDialogTitle` / `AlertDialogDescription` | `Title` / `Description` | Wire the accessible name and description |
| `AlertDialogClose` | `Close` | Cancel / confirm buttons |

No variants: tone comes from the buttons placed in the footer.

## States

Closed, opening (`data-starting-style`), open, closing (`data-ending-style`). Transitions run
200ms on `--motion-ease` / `--motion-ease-emphasized` (index.css) and stop under the global
reduced-motion gate.

## Accessibility

- Renders `role="alertdialog"`, named by the Title and described by the Description. The e2e
  helper `confirmDialog()` clicks buttons via `getByRole("alertdialog")`, so keep the role.
- Focus is trapped while open, Escape cancels, and focus returns to the trigger on close.
- A backdrop click does not dismiss an alert dialog: the user must choose.

## Do / Don't

- **Do** use it through `ConfirmDialog` for every destructive action (token reset, disconnect, clear, stop).
- **Do** give every dialog a Title, even a short one.
- **Don't** put forms or long content in it; it is a yes/no decision surface.
- **Don't** add a second close icon: the Cancel button is the way out.
