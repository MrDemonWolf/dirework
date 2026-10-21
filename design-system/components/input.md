---
source: apps/web/src/components/ui/input.tsx
tokens: [color.scheme, radius]
---

# Input

## Purpose

Single-line text field (Base UI `Input`). Used by `TaskManager` (new task), `TimerControls`
(durations), the Theme Center (`ColorInput`, `FieldRow`, `PhaseLabelsEditor`) and the bot
settings editors (`MessageEditor`, `CommandAliasEditor`, `BlockedViewersCard`).

## Anatomy

- Full width, `rounded-lg`, 1px border in `border-muted-foreground/70`, transparent fill
  (`bg-input/30` in dark), `px-2.5 py-1`.
- Height `h-9` on phones, `md:h-8`; `pointer-coarse:min-h-11` (44px) on touch.
- Text `text-base` (16px) on phones so iOS never zooms on focus, `md:text-sm`.
- Placeholder `text-muted-foreground`; file inputs get an inline `text-sm` button.

## Props and variants

All native `<input>` props (`React.ComponentProps<"input">`), including `type`. `className`
merges. No variants or sizes.

## States

- Focus-visible: ring-colored border plus `ring-1 ring-ring/50`.
- `aria-invalid`: destructive border and ring.
- Disabled: `bg-input/50` (`/80` dark), 50% opacity, `cursor-not-allowed`.

## Accessibility

- The border is `muted-foreground/70`, not `--input`, so an empty field keeps a 3:1 boundary
  in both themes (WCAG 1.4.11).
- Every input needs a label: a `<Label htmlFor>`, a wrapping label, or `aria-label`. e2e
  pins `getByRole("textbox", { name: "New task text" })` / `getByLabel("New task text")`,
  "Timer overlay URL" and "<label> URL".
- Set `aria-invalid` and point `aria-describedby` at the error text when validation fails.

## Do / Don't

- **Do** keep 16px text on touch; never shrink it below `text-base` on small screens.
- **Do** use `inputMode` / `type` for numeric and URL fields.
- **Don't** rely on the placeholder as the label.
- **Don't** swap the border to `border-input`; it fails the non-text contrast check on light.
