---
source: apps/web/src/components/ui/tabs.tsx
tokens: [color.scheme, radius]
---

# Tabs

## Purpose

Base UI `Tabs` for switching panels in place. Used by the Theme Center (`styles-page.tsx`:
Timer / Tasks / labels editors) and the Bot settings Replies page (`replies-page.tsx`: Task / Timer
replies).

## Anatomy

- **Tabs** (root): flex, `gap-2`, column when horizontal.
- **TabsList**: `rounded-xl` segmented track, `p-0.75`, `h-8` horizontal (`h-auto` on coarse pointers), `text-muted-foreground`.
- **TabsTrigger**: `rounded-lg` segment, `px-1.5 py-0.5`, `text-xs font-medium`, `size-4`
  icons, at least 44px tall on coarse pointers (`pointer-coarse:min-h-11`, pinned by `touch-targets.test.ts`). Active segment fills with `bg-background` (`bg-input/30` with an input border in dark).
  The `line` variant hides the fill and shows a 2px underline (`after:` bar) on the active tab.
- **TabsContent**: `flex-1`, `text-xs/relaxed`, no outline.

## Props and variants

| Export | Props |
|---|---|
| `Tabs` | `orientation?: "horizontal" \| "vertical"` (default `"horizontal"`), `value`, `defaultValue`, `onValueChange` |
| `TabsList` | `variant?: "default" \| "line"` (default `"default"`: `bg-muted` track; `line`: transparent, `gap-1`) |
| `TabsTrigger` | `value`, `disabled` |
| `TabsContent` | `value` |
| `tabsListVariants` | exported `cva` for custom lists |

## States

Trigger: idle (`text-foreground/75`, `dark:text-muted-foreground`), hover (`text-foreground`),
active (`data-active`), focus-visible, disabled / `aria-disabled` (50%, no pointer).

## Accessibility

- `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected` and `aria-controls`.
- Arrow keys move between tabs (Up/Down when vertical), Home/End jump; Tab moves into the panel.
- Focus-visible uses `ring-3 ring-ring/50` plus a 1px `outline-ring` (still its own recipe;
  see README "Focus").

## Do / Don't

- **Do** keep tab labels to one or two words.
- **Do** keep unsaved edits across tab switches (the editors share one dirty state and SaveBar).
- **Don't** use tabs for sequential steps; that is a checklist or wizard.
- **Don't** nest tab sets.
