# Task Card (TaskListWidget)

The viewer task list as rendered in the OBS task overlay. Tasks are grouped by author; each author gets a tinted header row (name + done/total count) and their tasks render inside.

Mirrors `apps/web/src/components/task-list-display.tsx` + `groupTasksByAuthor()` in `apps/web/src/lib/task-utils.ts`.

## Anatomy

- Header: author display name, `done/total` count, theme `username` color accent.
- Item: checkbox (or bullet), task text, optional cross-out when done. Rows take the task
  border radius and sit `TASK_ROW_GAP_PX` (2px) apart.
- Active item: a static tint of the username color (`ACTIVE_ROW_TINT_PERCENT`, 10%) plus an
  uppercase **Active** label in that color at the end of the row. No glow, no pulse.
- Broadcaster tasks (`priority: 0`) pin to the top.
- Scroll off: rows that don't fit are cut off and a `+N more` footer (task font color at
  `MORE_FOOTER_OPACITY`, 0.8) says how many.

## Proportions (default theme)

- Header `56px` tall, `26px` text, `12px 18px` padding, radius `14px 14px 0 0`.
- Body padding `8px`; task text `24px`, `8px` between author groups, task radius `12px`.
- No outlines: header, body and task borders are `0px` in every preset except Minimal Light,
  which keeps a 1px grey edge so white panels don't dissolve into a light scene.

## Tokens

- Username accent: theme `username` (default `#7F9CFF`).
- Checkbox tick: theme `accent`.
- Surface/text: theme `bg` / `text`.
- Body font: `--font-body` (IBM Plex Sans); header: Montserrat (`--font-display`).

## Accessibility

- Done state uses both strike-through *and* dimmed color — never color alone.
- On docs, the mock is illustrative; provide a text equivalent of the list.
