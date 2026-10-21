---
source: apps/web/src/components/task-manager.tsx
tokens: [color.scheme, radius, tracking]
---

# Task Manager

## Purpose

The dashboard Task Board (`dashboard/dashboard.tsx`): the owner's view of every task, theirs
and chat's, grouped by author. Polls `task.list` through the `/rpc` proxy at
`dashboardPollInterval(DASHBOARD_TASKS_POLL_MS)`; every write is an owner-only `task.*`
procedure sharing service code with the chat commands. The parent supplies the `.panel`
chrome.

## Anatomy

- Header: `ConsoleRule` "Task Board", the "Tasks" `h2`, a subtitle, and Open / Done counters
  (`font-mono text-2xl`) from the server `counts`.
- Add form: `Input` (placeholder "Add a task...", `maxLength` `MAX_TASK_LEN`) and an "Add"
  submit `Button`.
- List (`max-h-100`, scrolls): one `rounded-xl` card per author. Header: a dot (primary for
  the host, else the Twitch color or cornflower), the name, a "Host" accent chip for the owner,
  and a `done/total` console label. Rows: a round checkbox button, truncated text, an "Active"
  pulsing accent chip, a "Set as active" icon button and a destructive Remove icon button.
- Footer (when there are tasks): "Done tasks clear automatically after 24h", "Clear done" and
  "Clear all", both behind `ConfirmDialog`.
- Optional `preview` column beside the body on `lg`.

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `userTwitchId` | `string` | The owner's Twitch id; that group is the pinned "Host" group |
| `preview` | `ReactNode` | Optional overlay preview beside the add form and list |

## States

- Loading: two `Skeleton` rows. Failed first load: `QueryError` "Couldn't load tasks" with
  retry (never an empty board).
- Empty: a decorative ring and "A clean slate" with a `!task` hint.
- Rows: pending, active (`bg-primary/5` tint plus the chip, no edge bar), done (filled check,
  muted struck-through text). New rows since the last poll play a one-shot `row-enter`.
- Remove: one click, then a "Task removed" toast with "Undo" for 5 seconds (`task.restore`).
- Mutation failures toast `Couldn't <action>: ...`.

## Accessibility

- e2e pins: textbox "New task text", button "Add" (exact), `Mark "<text>" as done`,
  `<text> (done)`, `Remove "<text>"`, toast button "Undo", heading "Tasks".
- The checkbox uses `aria-disabled` (not `disabled`) so it keeps focus while pending and once
  done; clicks are guarded in the handler.
- Set active is `Set "<text>" as active`. Row actions are hidden only when the pointer can
  hover, and focus reveals them; each has an enlarged `after:` touch target.
- After a remove or activate drops focus to `<body>`, focus moves to the neighbor's Remove
  button (or the add input when the list empties).

## Do / Don't

- **Do** use `counts` for every done/total readout; the list holds only the newest done rows.
- **Do** keep bulk clears behind confirms and single removes on Undo.
- **Don't** color a whole row or add an edge bar for the author's Twitch color; it tints only
  the dot.
- **Don't** add a faster poll here; the cadence lives in `poll-intervals.ts`.
