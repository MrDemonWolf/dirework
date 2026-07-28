// ── Single source of default config values ──────────────────────────────────
// Pure data — NO drizzle/env imports. Referenced by:
//   - the schema column defaults (packages/db/src/schema/app.ts)
//   - @dirework/api config-shared (DEFAULT_* re-exports used by apps/web)
//   - @dirework/api timer-logic (DEFAULTS fallback when no config row exists)
// Changing a value here changes the drizzle column default → regenerate a
// migration with `bun run db:generate`.

/** Timer duration/cycle defaults (timer_config columns + timer-logic fallbacks). */
export const TIMER_CONFIG_DEFAULTS = {
  workDuration: 1500000,
  breakDuration: 300000,
  longBreakDuration: 900000,
  longBreakInterval: 4,
  startingDuration: 5000,
  noLastBreak: true,
  defaultCycles: 4,
};

/** Default phase labels (timer_config label_* columns). */
export const DEFAULT_PHASE_LABELS = {
  idle: "Resting",
  starting: "Gathering the Pack",
  work: "On the Hunt",
  break: "Den Rest",
  longBreak: "Pack Slumber",
  paused: "Paws'd",
  finished: "Hunt Complete",
};

/** Default task chat messages (bot_config msg_* columns). */
export const DEFAULT_TASK_MESSAGES = {
  taskAdded: 'Awooo! The task "{task}" has been added to the pack, {user}!',
  noTaskAdded: "Your paws are full, {user}! Finish a task with !done before adding another.",
  noTaskContent: "Tell the pack what you're working on! Use !task [task], {user}!",
  noTaskToEdit: "No task in your den to edit, {user} — try !edit [number] [new task]!",
  taskEdited: 'The hunt has changed! Task updated to "{task}" {user}',
  taskRemoved: 'Task "{task}" has been scent-wiped from the list, {user}',
  taskNext: "Paws-ome work finishing '{oldTask}'! Now tracking '{newTask}', {user}!",
  adminDeleteTasks: "All of the user's tasks have been cleared from the forest.",
  taskDone: 'Alpha work! You finished "{task}" {user}!',
  taskCheck: '{user}, you\'re on the scent of "{task}"',
  taskCheckUser: '{user}, {user2} is currently tracking: "{task}"',
  noTask:
    "Looks like you aren't tracking anything in the forest right now, {user} — start a hunt with !task [task]!",
  noTaskOther: "The scent is cold, {user} — that viewer isn't tracking a task right now.",
  notMod: "Grrr! Permission denied, {user} — only pack leaders (mods) can do that.",
  clearedAll: "The forest has been cleared of all tasks!",
  clearedDone: "All finished tasks have been cleared from the den!",
  nextNoContent: "Don't leave the pack hanging! Try !next [task], {user}!",
  help: "{user}, join the hunt: !task, !done, !edit, !remove, !focus, !check, !next — or !dwhelp for the full list.",
};

/**
 * Default timer chat messages (bot_config msg_* columns).
 *
 * Every message here is actually sent by a `!timer` command handler. Phase
 * *announcement* messages (work/break/longBreak/workRemind/streamStarting) and
 * the goal/finish/already-starting responses were removed in the P1 cleanup:
 * Workers has no always-on process, so nothing could ever fire them — they were
 * editable in the dashboard and silently did nothing. Do not re-add a message
 * here without an emit site in packages/api/src/bot/commands.ts.
 */
export const DEFAULT_TIMER_MESSAGES = {
  notRunning: "The timer isn't howling yet! Start it up first.",
  wrongCommand: "My ears didn't catch that... Try !timer start, pause, resume, skip, reset, or eta.",
  timerRunning: "The hunt is already in progress!",
  commandSuccess: "Paw-fect! Done!",
  cycleWrong: "That cycle count won't work — pick 1 to 99, like !timer start 4.",
  eta: "This phase ends in {phase} · the hunt is done in {time}",
};
