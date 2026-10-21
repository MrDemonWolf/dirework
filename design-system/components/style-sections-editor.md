---
source: apps/web/src/components/theme-center/style-sections-editor.tsx
tokens: [color.scheme]
---

# Style Sections Editor

## Purpose

Renders a Theme Center style editor from data: the field lists in `lib/style-sections.ts`
place every timer and task style key in one of four sections (Colors, Typography, Layout,
Opacity), and this component draws them. `TimerStyleEditor` and `TaskStyleEditor` both
use it, so a new style key shows up in the editor (and in "Reset section") by being added
to the list, not by new markup.

## Anatomy

- One `SectionGroup` per entry of `STYLE_SECTIONS`, in that order; Colors opens by default.
- Inside a section, rows are grouped by the overlay part they style (`field.group`, in
  first-appearance order), each group a `<fieldset>` with a `<legend>` ("Header",
  "Progress ring"…).
- Each row is the control for its `field.kind`: `ColorInput` (color), `OpacitySliderRow`
  (opacity), `TextFieldRow` (length, text), `SliderRow` (slider), `SwitchRow` (switch),
  `FontSelect` (font), plus an optional muted note under it (`field.note`).
- A section menu (`DropdownMenu` on a ghost icon `Button`) with one item, "Reset section".
- One shared `ConfirmDialog` for the reset.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `styles` | `T` | The draft style object being edited |
| `onChange` | `(styles: T) => void` | Receives the whole object; edits go through `setAtPath` |
| `fields` | `readonly StyleField<T>[]` | `TIMER_STYLE_FIELDS` or `TASK_STYLE_FIELDS` |
| `defaults` | `T` | The Default theme, which "Reset section" restores |
| `idPrefix` | `string` | Input ids are `{idPrefix}-{path with dots as dashes}` (`timer-style-ring-width`) |
| `overlayName` | `string` | "timer" or "task list", used in the reset confirmation copy |

Per field: `hidden(styles)` drops a row (the bullet rows while checkboxes are on),
`disabled(styles)` greys a slider (the scroll sliders while scrolling is off), `note(styles)` adds a hint line.

## States

- **Section unchanged**: "Reset section" is disabled (`sectionDiffers` is false).
- **Section edited**: the item enables; choosing it opens the confirmation.
- **Confirming**: "Reset {section}?" with copy saying every {noun} in the {overlayName}
  style returns to the Default theme and nothing reaches the stream until saved.
  Confirming replaces only that section's keys in the draft (`resetSection`); the page's
  `SaveBar` still owns saving.

## Accessibility

- Each group is a `fieldset`/`legend`, so a short row label ("Background") is announced
  with its part.
- The menu trigger's accessible name is "{Section} section options"; the e2e Theme Center
  spec opens "Colors section options", picks the "Reset section" menuitem and confirms the
  "Reset section" dialog button.
- Inputs have stable, prefixed ids, so each label stays bound when both editors share a page.

## Do / Don't

- **Do** add a style key by adding a field to `lib/style-sections.ts`; its test holds the
  lists to the full set of style keys.
- **Do** keep resets confirmed and draft-only.
- **Don't** hand-write rows for one editor; both editors must render from the field lists.
- **Don't** reset the whole style from a section menu; a reset is scoped to its section.
