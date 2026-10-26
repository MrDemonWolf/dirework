---
source: apps/web/src/components/theme-center/font-select.tsx
tokens: [color.scheme, radius]
---

# Font Select

## Purpose

Theme Center font picker over the fixed, self-hosted overlay font list (`FONT_OPTIONS` in `lib/overlay-font-options.ts`). Used by `TimerStyleEditor` (Font family) and `TaskStyleEditor` (Header font, Body font).

## Anatomy

- `FieldRow` label, then a `Select` whose trigger fills the control column with the editor
  inputs' height (`h-9`, `md:h-8`, `pointer-coarse:min-h-11`), border (`muted-foreground/70`)
  and type size (`text-base`, `md:text-sm`), set in the chosen face itself.
- Each option renders in its own family (`'{font}', sans-serif`), the same self-hosted faces the overlays use, with no Google CDN request.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Row label; id is derived as `font-{label-slug}` unless `id` is passed |
| `id` | `string` | Overrides the derived id (the section editor passes `{idPrefix}-{path}`) |
| `value` | `string` | Current family |
| `onChange` | `(value: string) => void` | Never called with an empty value |

## States

- Closed / open popup; highlighted option uses the shared `menuItemRecipe` (from `ui/select`).
- An empty/null selection from the primitive is ignored.

## Accessibility

- The trigger is labelled by the row label (`htmlFor` the derived id).
- Keyboard: the `Select` primitive's arrow-key list, with fill highlight and a focus-visible inset ring.

## Do / Don't

- **Do** add fonts to `FONT_OPTIONS` (and `public/fonts`), never as free text.
- **Do** keep each option rendered in its own face so owners pick by sight.
- **Don't** load fonts from a CDN.
- **Don't** reuse a label twice on one page.
