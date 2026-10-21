---
source: apps/web/src/components/task-list-display.tsx
tokens: [overlay]
---

# Task Card (TaskListDisplay)

## Purpose

The viewer task list as the stream sees it. `TaskListDisplay` renders it for the OBS task
overlay (`/overlay/l/[token]`, inside `FontGate`) and for the Theme Center live preview
(`style-preview-panel`), so the preview matches the overlay. Pure presentation: the
overlay page owns polling and hands it the view from `taskOverlayView`
(`lib/overlay-view.ts`); grouping comes from `groupTasksByAuthor` in `lib/task-utils.ts`.
The docs landing mock (`TaskListWidget`) shares the demo data through
`@dirework/overlay-kit`.

It reads the streamer's saved task style, not the UI tokens.

## Anatomy

- **Header**: `Tasks` plus an optional `{done}/{total}` counter at `HEADER_COUNT_OPACITY`,
  in the header font (Montserrat by default).
- **Body**: one card per author (`AuthorGroup`), stacked `task.marginBottom` apart.
  - **Author header**: display name in the author's Twitch chat color (falling back to
    `task.usernameColor`) over a `AUTHOR_HEADER_TINT_PERCENT` tint of that color, plus the
    author's `{done}/{total}` at `AUTHOR_COUNT_OPACITY`.
  - **Rows** (`TaskItem`): checkbox (or bullet), the line-clamped task text
    (`display.numberOfLines`), rows `TASK_ROW_GAP_PX` apart with the task border radius.
- **Active row**: a static tint of the username color (`ACTIVE_ROW_TINT_PERCENT`) plus an
  uppercase **Active** label in that color at the end of the row. No glow, no pulse.
- **"+N more" footer** (scroll off): rows that don't fit are cut off and a footer in the
  task font color at `MORE_FOOTER_OPACITY` says how many (`countHiddenRows`). It is
  overlaid on the bottom of the list area, so the area never resizes with it.
- No outlines: header, body and task borders are `0px` in every preset except Minimal
  Light, which keeps a 1px grey edge so white panels don't dissolve into a light scene.

## Props and variants

`TaskListDisplay({ config, tasks, counts? })`

| Prop | Type | Notes |
| --- | --- | --- |
| `config` | `TaskStylesConfig` | Saved styles (overlay) or unsaved edits (preview) |
| `tasks` | `Task[]` | Open tasks plus the newest done tasks the server returned |
| `counts` | `{ open, done, doneByAuthor }`, optional | Server totals for every counter; previews omit it and count `tasks` |

Variants are style switches: `display.useCheckboxes` (checkbox or bullet),
`display.crossOnDone`, `display.showDone`, `display.showCount`, and `scroll.enabled`
(infinite scroll at `scroll.pixelsPerSecond`, or the static list with the footer).

### Pinned values

The default theme (`DEFAULT_TASK_STYLES`, `packages/db/src/defaults.ts`) and the overlay
constants. `spec-catalog.test.ts` reads this table, so a changed default fails until this
spec moves with it.

| Value | Source | Default |
| --- | --- | --- |
| `header.height` | `DEFAULT_TASK_STYLES` | `56px` |
| `header.fontSize` | `DEFAULT_TASK_STYLES` | `26px` |
| `header.padding` | `DEFAULT_TASK_STYLES` | `12px 18px` |
| `header.border.radius` | `DEFAULT_TASK_STYLES` | `14px 14px 0 0` |
| `task.fontSize` | `DEFAULT_TASK_STYLES` | `24px` |
| `task.border.radius` | `DEFAULT_TASK_STYLES` | `12px` |
| `task.marginBottom` | `DEFAULT_TASK_STYLES` | `8px` |
| `ACTIVE_ROW_TINT_PERCENT` | `lib/overlay-view.ts` | `10` |
| `AUTHOR_HEADER_TINT_PERCENT` | `lib/overlay-view.ts` | `6` |
| `MORE_FOOTER_OPACITY` | `lib/overlay-view.ts` | `0.8` |
| `TASK_ROW_GAP_PX` | `lib/overlay-view.ts` | `2` |

The tints and opacities are composited by `theme-contrast.test.ts` for every preset, so
the Active label and the counters hold 4.5:1.

## States

- **Empty**: "No tasks yet" at 0.4 opacity in the body.
- **Pending / active / done**: done rows take `taskDone` colors, a filled tick in
  `checkbox.tickColor`, and a strike-through when `crossOnDone` is on.
- **Overflow**: scrolling lists loop with a second, `aria-hidden` copy trailing by
  `scroll.gapBetweenLoops`; static lists show the "+N more" footer.
- **Done hidden** (`showDone` off): done rows drop out, but every counter still comes
  from `counts`, so headers never reset to zero.
- **No payload or reset token**: the overlay page renders nothing.

## Accessibility

- Done uses strike-through and the dimmed done color together, never color alone.
- The Active label is visible text, so screen readers announce it as-is.
- The looping scroll's second copy is `aria-hidden`, so the list is read once.
- e2e (`20-dashboard.spec.ts`) finds a task on the overlay by its text; keep task text a
  plain text node.

## Do / Don't

- **Do** take every `{done}/{total}` from `counts`; the server returns at most 50 done rows.
- **Do** change a default in `packages/db/src/defaults.ts` and the table above together.
- **Don't** fade the whole done row: it multiplies over `taskDone.fontColor`, so the
  streamer's (contrast-checked) color never renders as chosen.
- **Don't** add a glow or pulse to the active row.
