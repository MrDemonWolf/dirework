---
source: apps/web/src/components/ui/switch.tsx
tokens: [color.scheme]
---

# Switch

## Purpose

Base UI `Switch` for on/off settings. Used by `ModeToggle` (dark mode), `FieldRow` (Theme
Center booleans), `CommandTabPanel` (command group enable) and `BotLiveControls` (mute and the command-group switches).

## Anatomy

- **Track**: pill (`rounded-full`), `h-[18.4px] w-8` (`h-3.5 w-6` at `sm`). Checked
  `bg-primary`; unchecked `bg-muted-foreground/70` on light, `bg-input/80` on dark.
- **Thumb**: `size-4` (`size-3` at `sm`) circle, `bg-background` on light; on dark
  `bg-foreground` unchecked and `bg-primary-foreground` checked. Slides right when checked.
- An invisible `after:-inset-x-3 after:-inset-y-2` pad widens the hit area; on coarse pointers it
  grows to at least 44px tall (`after:-inset-y-3.5`, `-inset-y-4` at `sm`; `touch-targets.test.ts`).

## Props and variants

| Prop | Type | Default |
|---|---|---|
| `size` | `"sm" \| "default"` | `"default"` |
| `checked` / `defaultChecked` / `onCheckedChange` / `disabled` / `name` | Base UI `Switch.Root.Props` | |

## States

Checked / unchecked (`data-checked` / `data-unchecked`), focus-visible, `aria-invalid`
(destructive ring), disabled (50%, `cursor-not-allowed`). Pre-mount placeholders use
controlled props so hydration matches (AGENTS.md "Hydration Safety").

## Accessibility

- `role="switch"` with `aria-checked`; Space toggles.
- Focus is an offset ring (`ring-2 ring-ring ring-offset-2 ring-offset-background`): a
  ring-colored border vanished against the checked primary fill.
- The unchecked light track uses `muted-foreground` for a 3:1 boundary (WCAG 1.4.11).
- Needs an accessible name; e2e pins `getByRole("switch", { name: "Toggle dark mode" })`.
- It carries the `peer` class, so a following `Label` dims with `peer-disabled:`.

## Do / Don't

- **Do** use it for settings that apply immediately.
- **Do** label it with what is on, not with "Enable".
- **Don't** use it inside a form that only applies on Save without making that clear (the SaveBar covers this on editors).
- **Don't** use a switch for a choice between two named options; use `Tabs` or a radio group.
