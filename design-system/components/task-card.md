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
  - **Rows** (`TaskItem`): checkbox (or bullet), the task text, rows `TASK_ROW_GAP_PX`
    apart with the task border radius. Task text has no length cap beyond `MAX_TASK_LEN`:
    it wraps (`overflow-wrap: anywhere`, so a URL or a string with no spaces breaks
    instead of running off the row) and ends in an ellipsis after `display.numberOfLines`
    lines (1–6, `TASK_LINES_MIN`/`TASK_LINES_MAX`; a row saved under the old 1–100 range
    is clamped by `clampTaskLines` on read and at render). Text and author name carry
    `dir="auto"`, so Arabic and Hebrew lay out right to left.
  - **Zalgo**: combining marks past two per letter are dropped (`limitCombiningMarks`,
    `@dirework/api/chat-text`) when a task or display name is stored and again at render.
- **Active row**: a static tint of the username color (`ACTIVE_ROW_TINT_PERCENT`) plus an
  uppercase **Active** label in that color at the end of the row, 0.55× the task font
  size but never under `ACTIVE_LABEL_MIN_PX` at the source size. No glow, no pulse.
- **"+N more" footer** (scroll off): only whole rows show. A row that doesn't fit is
  hidden, never drawn half cut; every row after it is hidden too; an author header shows
  only with at least one of its rows, and a group cut part way is clipped at its last
  shown row (`fitStaticList`). The footer, in the task font color at
  `MORE_FOOTER_OPACITY`, says how many rows are hidden. It is overlaid on the bottom of
  the list area, so the area never resizes with it. Measured after each render (new poll
  data) and on resize, never per frame; hiding uses `visibility` and `clip-path`, which
  don't move layout.
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

Every value of the default theme (`DEFAULT_TASK_STYLES`, `packages/db/src/defaults.ts`) and the
overlay constants. `spec-catalog.test.ts` derives the required rows from that object, so a
changed or added default fails until this spec moves with it.

| Value | Source | Default |
| --- | --- | --- |
| `display.showDone` | `DEFAULT_TASK_STYLES` | `true` |
| `display.showCount` | `DEFAULT_TASK_STYLES` | `true` |
| `display.useCheckboxes` | `DEFAULT_TASK_STYLES` | `true` |
| `display.crossOnDone` | `DEFAULT_TASK_STYLES` | `true` |
| `display.numberOfLines` | `DEFAULT_TASK_STYLES` | `4` |
| `fonts.header` | `DEFAULT_TASK_STYLES` | `Montserrat` |
| `fonts.body` | `DEFAULT_TASK_STYLES` | `Roboto` |
| `scroll.enabled` | `DEFAULT_TASK_STYLES` | `true` |
| `scroll.pixelsPerSecond` | `DEFAULT_TASK_STYLES` | `40` |
| `scroll.gapBetweenLoops` | `DEFAULT_TASK_STYLES` | `100` |
| `header.height` | `DEFAULT_TASK_STYLES` | `56px` |
| `header.background.color` | `DEFAULT_TASK_STYLES` | `#091533` |
| `header.background.opacity` | `DEFAULT_TASK_STYLES` | `0.95` |
| `header.border.color` | `DEFAULT_TASK_STYLES` | `#1b2b52` |
| `header.border.width` | `DEFAULT_TASK_STYLES` | `0px` |
| `header.border.radius` | `DEFAULT_TASK_STYLES` | `14px 14px 0 0` |
| `header.fontSize` | `DEFAULT_TASK_STYLES` | `26px` |
| `header.fontColor` | `DEFAULT_TASK_STYLES` | `#ffffff` |
| `header.padding` | `DEFAULT_TASK_STYLES` | `12px 18px` |
| `body.background.color` | `DEFAULT_TASK_STYLES` | `#091533` |
| `body.background.opacity` | `DEFAULT_TASK_STYLES` | `0.9` |
| `body.border.color` | `DEFAULT_TASK_STYLES` | `#1b2b52` |
| `body.border.width` | `DEFAULT_TASK_STYLES` | `0px` |
| `body.border.radius` | `DEFAULT_TASK_STYLES` | `0 0 14px 14px` |
| `body.padding.vertical` | `DEFAULT_TASK_STYLES` | `8px` |
| `body.padding.horizontal` | `DEFAULT_TASK_STYLES` | `8px` |
| `task.background.color` | `DEFAULT_TASK_STYLES` | `#12244a` |
| `task.background.opacity` | `DEFAULT_TASK_STYLES` | `0.9` |
| `task.border.color` | `DEFAULT_TASK_STYLES` | `#1b2b52` |
| `task.border.width` | `DEFAULT_TASK_STYLES` | `0px` |
| `task.border.radius` | `DEFAULT_TASK_STYLES` | `12px` |
| `task.fontSize` | `DEFAULT_TASK_STYLES` | `24px` |
| `task.fontColor` | `DEFAULT_TASK_STYLES` | `#eaf2ff` |
| `task.usernameColor` | `DEFAULT_TASK_STYLES` | `#7f9cff` |
| `task.padding` | `DEFAULT_TASK_STYLES` | `10px 14px` |
| `task.marginBottom` | `DEFAULT_TASK_STYLES` | `8px` |
| `task.maxWidth` | `DEFAULT_TASK_STYLES` | `100%` |
| `taskDone.background.color` | `DEFAULT_TASK_STYLES` | `#091533` |
| `taskDone.background.opacity` | `DEFAULT_TASK_STYLES` | `0.5` |
| `taskDone.fontColor` | `DEFAULT_TASK_STYLES` | `#8fa0c2` |
| `checkbox.size` | `DEFAULT_TASK_STYLES` | `20px` |
| `checkbox.background.color` | `DEFAULT_TASK_STYLES` | `#000000` |
| `checkbox.background.opacity` | `DEFAULT_TASK_STYLES` | `0` |
| `checkbox.border.color` | `DEFAULT_TASK_STYLES` | `#4a5b82` |
| `checkbox.border.width` | `DEFAULT_TASK_STYLES` | `2px` |
| `checkbox.border.radius` | `DEFAULT_TASK_STYLES` | `6px` |
| `checkbox.margin.top` | `DEFAULT_TASK_STYLES` | `4px` |
| `checkbox.margin.left` | `DEFAULT_TASK_STYLES` | `2px` |
| `checkbox.margin.right` | `DEFAULT_TASK_STYLES` | `8px` |
| `checkbox.tickChar` | `DEFAULT_TASK_STYLES` | `✔` |
| `checkbox.tickSize` | `DEFAULT_TASK_STYLES` | `14px` |
| `checkbox.tickColor` | `DEFAULT_TASK_STYLES` | `#00aced` |
| `bullet.char` | `DEFAULT_TASK_STYLES` | `•` |
| `bullet.size` | `DEFAULT_TASK_STYLES` | `20px` |
| `bullet.color` | `DEFAULT_TASK_STYLES` | `#7c8db0` |
| `bullet.margin.top` | `DEFAULT_TASK_STYLES` | `0px` |
| `bullet.margin.left` | `DEFAULT_TASK_STYLES` | `2px` |
| `bullet.margin.right` | `DEFAULT_TASK_STYLES` | `8px` |
| `ACTIVE_ROW_TINT_PERCENT` | `lib/overlay-view.ts` | `10` |
| `ACTIVE_LABEL_MIN_PX` | `lib/overlay-view.ts` | `14` |
| `AUTHOR_HEADER_TINT_PERCENT` | `lib/overlay-view.ts` | `6` |
| `MORE_FOOTER_OPACITY` | `lib/overlay-view.ts` | `0.8` |
| `AUTHOR_COUNT_OPACITY` | `lib/overlay-view.ts` | `0.8` |
| `HEADER_COUNT_OPACITY` | `lib/overlay-view.ts` | `0.8` |
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
