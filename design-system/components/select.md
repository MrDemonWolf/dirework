---
source: apps/web/src/components/ui/select.tsx
tokens: [color.scheme, radius]
---

# Select

## Purpose

Base UI `Select` styled to match the dropdown menu. Used by `FontSelect` in the Theme Center
(overlay font pickers).

## Anatomy

- **Trigger**: `rounded-lg` (`rounded-md` at `sm`) bordered box, `border-muted-foreground/70`
  (the same ≥3:1 boundary as `Input`), transparent fill (`bg-input/30` dark), value on the
  left, muted `ChevronDownIcon` on the right. Default size matches `Input`: `text-base`
  (`md:text-sm`), `h-9` (`md:h-8`), `pointer-coarse:min-h-11`; `sm` is `h-7`, `text-xs`.
  Placeholder in `text-muted-foreground`.
- **Content**: portaled popup, `rounded-2xl`, `border-border/50`, `bg-popover`, `p-1`,
  `shadow-lg`, `backdrop-blur-2xl`, min width `min-w-36`; scroll arrows top and bottom.
- **Item**: `menuItemRecipe` from `dropdown-menu.tsx`, check indicator at `right-2`,
  selected item `font-medium`.
- **Label**: `text-xs text-muted-foreground`. **Separator**: 1px `bg-border`.

## Props and variants

| Export | Notes |
|---|---|
| `Select` | `Select.Root`: `value`, `onValueChange`, `items`, `disabled` |
| `SelectTrigger` | `size?: "sm" \| "default"` (default `"default"`) |
| `SelectValue` | Renders the chosen label / placeholder |
| `SelectContent` | `side` `"bottom"`, `sideOffset` `4`, `align` `"center"`, `alignOffset` `0`, `alignItemWithTrigger` `true` |
| `SelectGroup`, `SelectLabel`, `SelectItem`, `SelectSeparator` | Base UI parts |
| `SelectScrollUpButton`, `SelectScrollDownButton` | Rendered by `SelectContent` |

## States

Trigger: hover (`bg-input/50` dark), focus-visible (ring border plus `ring-1 ring-ring/50`),
`aria-invalid`, disabled (50%). Items: highlighted fill, selected check, disabled. With
`alignItemWithTrigger` the popup opens over the trigger without the scale transition.

## Accessibility

- Trigger is a combobox-style button announcing the current value; the list is `role="listbox"`
  with `role="option"` items.
- Arrow keys move, Enter selects, Escape closes, type-ahead jumps to an option.
- Give the trigger a label (`FontSelect` wires one through `FieldRow`).
- Item focus follows the README "Focus" recipe (shared `menuItemRecipe`).

## Do / Don't

- **Do** keep item rows on `menuItemRecipe`; `menu-consistency.test.ts` checks the import.
- **Do** use it for a fixed list of five or more options; use `Tabs` or a radio group for two to four.
- **Don't** copy the recipe string into this file or add `focus:` outlines.
- **Don't** use it for actions; that is a `DropdownMenu`.
