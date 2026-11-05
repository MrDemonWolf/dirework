---
source: apps/web/src/components/ui/tooltip.tsx
tokens: [color.scheme, radius]
---

# Tooltip

## Purpose

Base UI `Tooltip` for short supplementary hints on icon buttons and truncated values. Used by
the dashboard, `TaskManager`, `TimerControls`, `SecretUrlRow` and `MessageEditor`.

## Anatomy

- **Content**: portaled, positioned popup on `popupSurfaceRecipe` from `dropdown-menu.tsx`
  (the menus' `bg-popover` / `text-popover-foreground` surface, `border-border/50`,
  `backdrop-blur-2xl`; fades and scales from 98%, 150ms). It keeps its own smaller
  `rounded-lg`, `px-3 py-1.5`, `text-xs` and a lighter `shadow-md` in place of the recipe's
  `shadow-lg`.
- **Arrow**: `fill-popover` with a `border/50` stroke, pointing at the trigger.

## Props and variants

| Export | Notes |
|---|---|
| `TooltipProvider` | Shares open/close delays across tooltips |
| `Tooltip` | `Tooltip.Root`: `open`, `onOpenChange`, `delay` |
| `TooltipTrigger` | Usually `render={<Button ... />}` |
| `TooltipContent` | `side` `"top"`, `sideOffset` `4`, `align` `"center"` |

No variants.

## States

Hidden, opening (hover delay or keyboard focus), open, closing. Transitions stop under the
global reduced-motion gate.

## Accessibility

- Opens on hover and on keyboard focus of the trigger; Escape closes it.
- The tooltip text describes the trigger; it is not its name. Icon-only triggers still need
  their own `aria-label` (e2e pins names like "Show <label> URL" on the buttons, not the tooltips).
- Touch users never see hover tooltips, so nothing essential may live only here.

## Do / Don't

- **Do** keep tooltip text to a short phrase.
- **Do** use it to explain a disabled control's reason when there is no room inline.
- **Don't** pass a `bg-*` class to `TooltipContent`; it shares the menus' surface
  (`menu-consistency.test.ts`).
- **Don't** put links, buttons or other interactive content inside a tooltip.
- **Don't** repeat the visible label verbatim.
