---
source: apps/web/src/components/theme-center/task-style-editor.tsx
tokens: [color.scheme, radius, tracking]
---

# Task Style Editor

## Purpose

Theme Center editor for the task-list overlay's styles: the Tasks tab of `/dashboard/styles` (`styles-page.tsx`). A controlled form over `TaskStylesConfig`; every edit emits a full new styles object that the page holds as unsaved working state (driving `StylePreviewPanel`) until Save.

## Anatomy

Stacked `SectionGroup`s built from `FieldRow` rows:

| Section | Default | Fields |
|---|---|---|
| Display | open | Show done tasks, Show task count, Checkboxes, Cross out done tasks (switches), Lines per task (slider 1–5) |
| Fonts | open | Header font, Body font (`FontSelect`) |
| Header | open | Height, background, border, Font size, Font color, Padding |
| Body | collapsed | background, border, Vertical / Horizontal padding |
| Task item | open | background, border, Font size, Font color, Fallback username color, Padding, Margin bottom, Max width |
| Done tasks | collapsed | background, Font color |
| Checkbox | collapsed | Size, background, border, margins, Tick character, Tick size, Tick color |
| Bullet | collapsed, only when checkboxes are off | Character, Size, Color, margins |
| Scroll | collapsed | Enabled, Speed (px/s), Loop gap |

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `styles` | `TaskStylesConfig` | Controlled |
| `onChange` | `(styles: TaskStylesConfig) => void` | Emits the whole object; nested objects (e.g. `body.padding`) are spread by the editor |

## States

- Checkboxes on: a note says bullet options appear when they are off.
- Inline validation per row (`cssLengthSchema`, `glyphSchema` for tick/bullet characters).

## Accessibility

- Every control has a unique `task-style-*` id bound to its label; sliders use `aria-labelledby`.
- Collapsed sections are `SectionGroup` disclosures (keyboard-operable buttons).

## Do / Don't

- **Do** compose from `BackgroundFields` / `BorderFields` / `MarginFields` rather than repeating rows.
- **Do** keep the edit-then-Save model; the page's Save bar persists, and e2e expects "Styles saved".
- **Don't** add a field the server's task style schema doesn't accept.
- **Don't** open every section by default; rarely-tuned groups start collapsed.
