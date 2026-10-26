---
source: apps/web/src/components/task-manager.tsx
tokens: [color.scheme, radius, tracking]
---

# Task Manager

## Purpose

The dashboard Task Board (`dashboard/dashboard.tsx`): the owner's view of every task, theirs
and chat's, grouped by author, across the full width of its panel (the overlay URLs live in
the timer console's `ObsSources`). Polls `task.list` through the `/rpc` proxy at
`dashboardPollInterval(DASHBOARD_TASKS_POLL_MS)`; every write is an owner-only `task.*`
procedure sharing service code with the chat commands. The parent supplies the `.panel-hero`
chrome.

## Anatomy

- Header, one line (`PANEL_HEADER_CLASS` from `lib/panel-header.ts`, shared with the timer
  console): the "Tasks" `h2`, then "N open" / "N done" (mono semibold numbers, muted words)
  from the server `counts`, and a ghost icon button that opens the board options `DropdownMenu`: destructive "Clear done (N)" and "Clear all (N)" items, each
  opening its `ConfirmDialog`.
- Add form: `Input` (placeholder "Add a task...", `maxLength` `MAX_TASK_LEN`) and an "Add"
  submit `Button`.
- List (`max-h-100`, scrolls): one `rounded-xl` `Collapsible` per author. Its header is the
  trigger (`min-h-11`): a chevron, a dot (primary for the host, else the Twitch color or
  cornflower), the name, a "Host" accent chip for the owner, and a `done/total` console label.
  Rows (`min-h-11`, `items-start`): a round checkbox button, then a body of the task text and
  a meta line (`data-slot="task-row-meta"`): the status chip slot and the action group
  (`TaskRowControls`). Chips: the focus (`active`) gets "Focus", a pulsing `accent` chip;
  a `started` task gets "Started", a quieter `idle` chip with a half-lit `dot="half"` (◐);
  pending and done rows have none. Actions come from `taskRowActions` (`lib/task-utils.ts`):
  pending → Start (plus Make focus in the menu only), started → Make focus + Pause, focus →
  Pause; done → none. On a hover-capable pointer the inline ones are ghost `icon-xs`
  buttons (Play / Focus / Pause icons, tooltips) beside a destructive Remove, then a ⋯
  button; on a coarse pointer (`pointer-coarse:hidden`) only the ⋯ button shows, at 44px.
  The ⋯ `DropdownMenu` always lists every action: the status actions, "Mark done" (open
  rows), a separator, destructive "Remove"; items are `pointer-coarse:min-h-11`. No swipe or
  long-press. The text wraps in full, never clamped (`wrap-anywhere`, so a long URL breaks
  instead of squeezing the row; `dir="auto"` for right-to-left tasks). Below `sm` the meta
  line sits under the text, so the text gets the row's full width on a 320px phone; from
  `sm` it rides beside the text.
- Footer (when there are tasks): "Done tasks clear automatically after 24h".

## Props and variants

| Prop | Type | Notes |
|---|---|---|
| `userTwitchId` | `string` | The owner's Twitch id; that group is the pinned "Host" group |

## States

- Loading: two `Skeleton` rows. Failed first load: `QueryError` "Couldn't load tasks" with
  retry (never an empty board).
- Empty: a decorative ring, "What are you working on today?", a `!task` hint and an
  "Add a task" button that focuses the add input.
- Rows: pending, focus (`bg-primary/5` tint plus the "Focus" chip, no edge bar), started (the
  "Started" chip only, no tint), done (filled check, muted struck-through text). New rows
  since the last poll play a one-shot `row-enter`.
- Start cap: when the author already holds a focus and `MAX_STARTED_PER_AUTHOR` started
  tasks (`isAtStartCap`), Start is disabled on their other rows; the icon's tooltip and the
  menu item's second line say "3 in progress — finish or pause one" (`START_CAP_REASON`). A
  `cap_reached` / `not_startable` answer from a stale list toasts and refetches.
- Status actions wait for the server and refetch the list (the server decides focus vs
  started); one request per click: a row's Start / Make focus / Pause are off while one of
  them is in flight.
- Author groups start open and fold from their header; the folded set is component state only,
  so a reload opens them all.
- Bulk clears: "Clear done" is disabled with no done tasks, "Clear all" with no tasks.
- Remove: one click, then a "Task removed" toast with "Undo" for 5 seconds (`task.restore`).
- Mutation failures toast `Couldn't <action>: ...`.

## Accessibility

- e2e pins: textbox "New task text", button "Add" (exact), `Mark "<text>" as done`,
  `<text> (done)`, `Remove "<text>"`, `Start "<text>"`, `Make "<text>" the focus`,
  `Pause "<text>"`, `Actions for "<text>"` (the ⋯ button; menu items "Start", "Make focus",
  "Pause", "Mark done", "Remove"), chips "Focus" / "Started", toast button "Undo", heading
  "Tasks".
- The options button is named "Task board options"; its confirms are "Clear done" and
  "Clear all tasks".
- The author header is a button with `aria-expanded`; its count reads "<done>/<total> done".
- The checkbox uses `aria-disabled` (not `disabled`) so it keeps focus while pending and once
  done; clicks are guarded in the handler.
- The row controls' group carries `HOVER_REVEAL` (on the group, so a disabled button's
  `disabled:opacity-50` can't show it unhovered): hidden only when the pointer can hover,
  revealed by row hover, focus within, or an open ⋯ menu; each button has an enlarged
  `after:` target. Disabled Start keeps focus (`focusableWhenDisabled`), so its
  tooltip is reachable from the keyboard.
- After a remove or a status change drops focus to `<body>`, focus moves to the neighbor's
  (or the changed row's) ⋯ button (`data-row-menu`), in an open group, or to the add input
  when the list empties.

## Do / Don't

- **Do** use `counts` for every done/total readout; the list holds only the newest done rows.
- **Do** keep bulk clears in the options menu behind their confirms, and single removes on Undo.
- **Don't** persist folded groups (no `localStorage`); `dashboard-layout.test.ts` pins it.
- **Don't** color a whole row or add an edge bar for the author's Twitch color; it tints only
  the dot.
- **Don't** add a faster poll here; the cadence lives in `poll-intervals.ts`.
