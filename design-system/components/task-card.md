# Task Card (TaskListWidget)

The viewer task list as rendered in the OBS task overlay. Tasks are grouped by author; each author gets a tinted header row (name + done/total count) and their tasks render inside.

Mirrors `apps/web/src/components/task-list-display.tsx` + `groupTasksByAuthor()` in `apps/web/src/lib/task-utils.ts`.

## Anatomy

- Header: author display name, `done/total` count, theme `username` color accent.
- Item: checkbox (or bullet), task text, optional cross-out when done.
- Broadcaster tasks (`priority: 0`) pin to the top.

## Tokens

- Username accent: theme `username` (default Cornflower `#6B8BF5`).
- Checkbox tick: theme `accent`.
- Surface/text: theme `bg` / `text`.
- Body font: `--ds-font-family-sans` (IBM Plex Sans); header: Montserrat.

## Accessibility

- Done state uses both strike-through *and* dimmed color — never color alone.
- On docs, the mock is illustrative; provide a text equivalent of the list.
