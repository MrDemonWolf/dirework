---
source: apps/web/src/components/theme-center/color-input.tsx
tokens: [color.scheme, radius]
---

# Color Input

## Purpose

Theme Center color field: a native swatch picker and a hex text input in one bordered field, on the shared `FieldRow` grid, as wide as every other control. Used by `StyleSectionsEditor` for every color key.

## Anatomy

- `FieldRow` label column, then one field filling the control column: a wrapper wearing the `Input` primitive's frame (`inputFrameClassName`) with its focus/invalid rings (`focus-within`, `has-aria-invalid`), around two bare inputs.
- Left square: `<input type="color">` (`w-9`, `md:w-8`, `pointer-coarse:w-11`, full field height), its swatch inset with a `rounded-xs` corner and a `foreground/25` hairline so a swatch matching the page still reads; a divider on its right.
- Right: a bare mono text input at `Input`'s type sizes (`text-base`, `md:text-sm`; placeholder `#000000`).
- Optional hint line under the label, and an error line when the draft is invalid.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Row label; also seeds the default id |
| `value` | `string` | Saved/working color |
| `onChange` | `(value: string) => void` | Receives only `#rrggbb` |
| `id` | `string` | Defaults to `color-{label-slug}`, so labels must be unique per page when omitted |
| `hint` | `string` | One-line helper under the label |

## States

- **Typing**: a local draft; only a full `#rrggbb` propagates, so a half-typed `#0` never reaches the live preview.
- **Blur with `#rgb`**: expanded to `#rrggbb` and committed.
- **Blur with anything else**: kept and flagged "Not applied. Use a hex color like #1a2b3c (current: …)"; the whole field takes the destructive border.
- **Non-hex stored value** (any color the server allowlist takes): the swatch shows black; the text field shows the stored value.
- **Touch**: the field is 44px tall and the swatch spans its full height and 44px width.

## Accessibility

- The text input is labelled by the row label; the swatch is named `{label} color picker`.
- `aria-invalid` plus `aria-describedby` the hint and the error (WCAG 3.3.1); the error line is `aria-live="polite"` via `FieldRow`.
- Keyboard focus on either input lights the shared field border and ring.

## Do / Don't

- **Do** emit hex only: it is a subset of `cssColorSchema`, so whatever this sets always saves.
- **Do** keep an invalid draft visible instead of silently reverting it.
- **Don't** pass a duplicate `label` on one page without an explicit `id`.
- **Don't** add free-form color syntaxes here; the overlay CSS allowlist is the boundary.
