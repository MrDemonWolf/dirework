---
source: apps/web/src/components/ui/dropdown-menu.tsx
tokens: [color.scheme, radius]
---

# Dropdown Menu

## Purpose

Base UI `Menu` styled as a frosted popup. Used by `UserMenu` (the header account menu), the
Theme Center menus, the Task Board options menu and each task row's ⋯ menu. It also owns
the two recipes the other popups import: `menuItemRecipe`, so every menu and list row in
the app highlights the same way, and `popupSurfaceRecipe`, so every menu, Select list and
tooltip sits on the same surface.

## Anatomy

- **Surface** (`popupSurfaceRecipe`): `bg-popover` / `text-popover-foreground` (the fill
  dialogs and toasts use too), `border-border/50`, `shadow-lg`, `backdrop-blur-2xl`; fades
  and scales from 98% (150ms) from the side it opens on. Every popup, menus included, sits
  on it; a call site sets width and alignment, never a fill.
- **Content**: portaled, positioned popup on that surface; `rounded-2xl`, `p-1.5`, min width
  `min-w-32`, width follows the anchor, scrolls within `--available-height`.
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
| `DropdownMenuSub`, `DropdownMenuSubTrigger` (`inset`) | A submenu's popup is a `DropdownMenuContent` with `side="right"` |
| `DropdownMenuSeparator`, `DropdownMenuShortcut` | Static |
| `menuItemRecipe` | Exported class string, reused by `SelectItem` |
| `popupSurfaceRecipe` | Exported class string, the start of `SelectContent`'s and `TooltipContent`'s classes |

## States

Highlighted (`data-highlighted`, set by hover AND arrow keys) paints `bg-accent`. Destructive
items (Sign out, Clear done / Clear all, Remove) stay red in every state: `text-destructive`
at rest; highlighted, a `bg-destructive/10` tint in both themes with the label and icon in
`text-destructive-strong` (≥ 4.5:1 on that tint; plain red on the old dark `/20` tint was
4.25:1); keyboard focus draws the inset ring in `ring-destructive`, never the blue
`ring-ring`, ≥ 3:1 against the tint. `tokens-contrast.test.ts` measures all three, on `--popover`. Disabled rows are 50% and
ignore the pointer. Open / closed transitions use `data-starting-style` / `data-ending-style`.

## Accessibility

- Trigger is a button with `aria-haspopup="menu"`; items are `role="menuitem"` (checkbox and
  radio variants `menuitemcheckbox` / `menuitemradio`). e2e opens the account menu via
  `getByRole("button", { name: /^Account menu/ })` and clicks `getByRole("menuitem", { name: "Sign out" })`.
- Arrow keys move, Enter / Space activate, Escape closes and returns focus to the trigger,
  type-ahead jumps to a label.
- Focus follows the README "Focus" recipe: fill for highlight, `focus-visible:ring-2 ring-inset`
  only for keyboard focus (`ring-destructive` on destructive rows). The 10px row radius nests inside the popup's `rounded-2xl` + `p-1.5`.

## Do / Don't

- **Do** use `variant="destructive"` for Sign out style actions that end something.
- **Do** import `menuItemRecipe` for any new list row instead of copying it.
- **Do** start a new popup's classes with `popupSurfaceRecipe` and add only its geometry.
- **Don't** pass a `bg-*` class to `DropdownMenuContent` (or `SelectContent`,
  `TooltipContent`); `menu-consistency.test.ts` fails on a call site that repaints the surface.
- **Don't** use `focus:` outlines on rows; they also fire on click and read as a boxed hover.
- **Don't** put form inputs inside a menu; use a popover or a page section.
