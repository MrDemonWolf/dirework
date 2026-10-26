---
source: apps/web/src/components/theme-center/style-field-groups.tsx
tokens: [color.scheme, radius, tracking]
---

# Style Field Groups

## Purpose

Theme Center field controls that wrap a `FieldRow` primitive with a value conversion, used by `StyleSectionsEditor`. Today that is the opacity slider: the config stores 0–1, the owner edits 0–100%.

## Anatomy

A `SliderRow` (no wrapper element), so it sits in whichever group fieldset the editor provides and shares the editor's control column.

## Props and variants

| Export | Props | Renders |
|---|---|---|
| `OpacitySliderRow` | `label`, `id`, `value` (0–1), `onChange` | `SliderRow` 0–100 with `%` readout; the one place the ×100 / ÷100 lives |

## States

Inherited from `SliderRow`.

## Accessibility

- Announces as a percentage via `SliderRow`'s `getAriaValueText`.
- Ids are passed in, so labels stay bound when both style editors share a page.

## Do / Don't

- **Do** put a value conversion between the config and a row here, once.
- **Don't** store opacity as 0–100; the config is 0–1.
- **Don't** wrap rows in their own section or fieldset; the editor owns grouping.
