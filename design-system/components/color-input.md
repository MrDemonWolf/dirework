---
source: apps/web/src/components/theme-center/color-input.tsx
tokens: [color.scheme, radius]
---

# Color Input

## Purpose

Theme Center color field: a native swatch picker paired with a hex text input, on the shared `FieldRow` grid. Used by `TimerStyleEditor`, `TaskStyleEditor` and the `BackgroundFields` / `BorderFields` clusters.

## Anatomy

- `FieldRow` label column, then a `32px` `<input type="color">` swatch and a `w-24` mono `Input` (placeholder `#000000`).
- Optional hint line, and an error line when the draft is invalid.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Row label; also seeds the default id |
| `value` | `string` | Saved/working color |
| `onChange` | `(value: string) => void` | Receives only `#rrggbb` |
| `id` | `string` | Defaults to `color-{label-slug}`, so labels must be unique per page when omitted |
| `hint` | `string` | One-line helper under the row |

## States

- **Typing**: a local draft; only a full `#rrggbb` propagates, so a half-typed `#0` never reaches the live preview.
- **Blur with `#rgb`**: expanded to `#rrggbb` and committed.
- **Blur with anything else**: kept and flagged "Not applied. Use a hex color like #1a2b3c (current: …)".
- **Non-hex stored value** (any color the server allowlist takes): the swatch shows black; the text field shows the stored value.

## Accessibility

- The text input is labelled by the row label; the swatch is named `{label} color picker`.
- `aria-invalid` plus `aria-describedby` the hint and the error (WCAG 3.3.1); the error line is `aria-live="polite"` via `FieldRow`.

## Do / Don't

- **Do** emit hex only: it is a subset of `cssColorSchema`, so whatever this sets always saves.
- **Do** keep an invalid draft visible instead of silently reverting it.
- **Don't** pass a duplicate `label` on one page without an explicit `id`.
- **Don't** add free-form color syntaxes here; the overlay CSS allowlist is the boundary.
