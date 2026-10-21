---
source: apps/web/src/components/ui/dropdown-menu.tsx
tokens: [color.scheme, radius]
---

# Dropdown Menu

## Purpose

Base UI `Menu` styled as a frosted popup. Used by `UserMenu` (the header account menu), the
Theme Center section menus and the Task Board options menu. It also owns `menuItemRecipe`,
the one row recipe `Select` imports, so every menu and list row in the app highlights the
same way.

## Anatomy

- **Content**: portaled, positioned popup; `rounded-2xl`, `border-border/50`, `bg-popover`,
  `p-1.5`, `shadow-lg`, `backdrop-blur-2xl`, min width `min-w-32`, width follows the anchor,
  scrolls within `--available-height`. Fades and scales from 98% (150ms).
- **Item** (`menuItemRecipe`): `rounded-md` row, `px-2.5 py-2`, `text-sm/none`, `gap-2.5`,
  `size-4` icons. `inset` items pad left `pl-8` to align with checkbox/radio rows.
- **Label**: `text-xs text-muted-foreground`. **Separator**: 1px `bg-border`, bleeds to the popup edge.
- **Shortcut**: right-aligned `text-xs tracking-widest` muted text.
- **Checkbox / radio items**: check indicator pinned `right-2`.
- **Sub trigger**: trailing chevron; stays filled while its submenu is open.

## Props and variants

| Export | Notes |
|---|---|
| `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuPortal`, `DropdownMenuGroup` | Base UI parts |
| `DropdownMenuContent` | `align` `"start"`, `alignOffset` `0`, `side` `"bottom"`, `sideOffset` `4` |
| `DropdownMenuItem` | `variant?: "default" \| "destructive"` (default `"default"`), `inset?: boolean` |
| `DropdownMenuLabel` | `inset?: boolean` |
| `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` | `checked` / `value` |
| `DropdownMenuSub`, `DropdownMenuSubTrigger` (`inset`), `DropdownMenuSubContent` | Sub content defaults: `side` `"right"`, `alignOffset` `-3`, `sideOffset` `0` |
| `DropdownMenuSeparator`, `DropdownMenuShortcut` | Static |
| `menuItemRecipe` | Exported class string, reused by `SelectItem` |

## States

Highlighted (`data-highlighted`, set by hover AND arrow keys) paints `bg-accent`; destructive
items highlight `bg-destructive/10` (`/20` dark) and stay red. Disabled rows are 50% and
ignore the pointer. Open / closed transitions use `data-starting-style` / `data-ending-style`.

## Accessibility

- Trigger is a button with `aria-haspopup="menu"`; items are `role="menuitem"` (checkbox and
  radio variants `menuitemcheckbox` / `menuitemradio`). e2e opens the account menu via
  `getByRole("button", { name: /^Account menu/ })` and clicks `getByRole("menuitem", { name: "Sign out" })`.
- Arrow keys move, Enter / Space activate, Escape closes and returns focus to the trigger,
  type-ahead jumps to a label.
- Focus follows the README "Focus" recipe: fill for highlight, `focus-visible:ring-2 ring-inset`
  only for keyboard focus. The 10px row radius nests inside the popup's `rounded-2xl` + `p-1.5`.

## Do / Don't

- **Do** use `variant="destructive"` for Sign out style actions that end something.
- **Do** import `menuItemRecipe` for any new list row instead of copying it.
- **Don't** use `focus:` outlines on rows; they also fire on click and read as a boxed hover.
- **Don't** put form inputs inside a menu; use a popover or a page section.
