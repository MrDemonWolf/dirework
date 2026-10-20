// ── Single source of default config values ──────────────────────────────────
// Pure data — NO drizzle/env imports. Referenced by:
//   - the schema column defaults (packages/db/src/schema/app.ts)
//   - @dirework/api config-defaults (DEFAULT_* re-exports used by apps/web)
//   - @dirework/api timer-logic (DEFAULTS fallback when no config row exists)
// Changing a value that feeds a schema column default changes the drizzle
// snapshot → regenerate a migration with `bun run db:generate`. The bot message
// defaults are the exception: the schema reads the frozen *_MESSAGE_COLUMN_DEFAULTS,
// and the wording the app uses (DEFAULT_*_MESSAGES) can change freely.

/** Every timer state-machine status — single source for status literals. */
export const TIMER_STATUSES = [
  "idle",
  "starting",
  "work",
  "break",
  "longBreak",
  "paused",
  "finished",
] as const;

export type TimerStatus = (typeof TIMER_STATUSES)[number];

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

/**
 * Default task chat messages: the wording a reply has until the owner edits it.
 *
 * NOT the bot_config column defaults — those are TASK_MESSAGE_COLUMN_DEFAULTS
 * below, and frozen. A stored reply that still equals any earlier default is
 * read back as the value here (`buildBotConfig` in @dirework/api
 * config-shared), so rewording a line reaches every instance whose owner never
 * customized it, with no migration and no write. When you change a line, append
 * its old wording to LEGACY_TASK_MESSAGES. Keep each line well under
 * MAX_MESSAGE_TEMPLATE_BYTES and never start one with `!`, `/` or `.`.
 */
export const DEFAULT_TASK_MESSAGES = {
  taskAdded: 'Added "{task}" to the pack, {user}.',
  noTaskAdded: "Your paws are full, {user}. Finish one with !done before adding another.",
  noTaskContent: "Tell the pack what you're working on, {user}: !task [task]",
  noTaskToEdit: "Nothing to edit there, {user}. Try !edit [number] [new task].",
  taskEdited: 'Updated your task to "{task}", {user}.',
  taskRemoved: 'Removed "{task}" from the list, {user}.',
  taskNext: 'Finished "{oldTask}". Now on "{newTask}", {user}.',
  adminDeleteTasks: "Cleared that viewer's tasks.",
  taskDone: 'Nice work, {user}. "{task}" is done.',
  taskCheck: '{user}, you\'re on "{task}".',
  taskCheckUser: '{user}, {user2} is on "{task}".',
  noTask: "You don't have a task yet, {user}. Start one with !task [task].",
  noTaskOther: "{user}, that viewer doesn't have a task right now.",
  notMod: "Sorry {user}, only mods can do that.",
  clearedAll: "Cleared every task.",
  clearedDone: "Cleared the finished tasks.",
  nextNoContent: "What's next, {user}? Try !next [task].",
  help: "{user}, commands: !task, !done, !edit, !remove, !focus, !check, !today, !next. Full list: !dwhelp",
};

/**
 * Default timer chat messages. Same rules as DEFAULT_TASK_MESSAGES.
 *
 * Every message here is actually sent by a `!timer` command handler. Phase
 * *announcement* messages (work/break/longBreak/workRemind/streamStarting) and
 * the goal/finish/already-starting responses were removed in the P1 cleanup:
 * Workers has no always-on process, so nothing could ever fire them — they were
 * editable in the dashboard and silently did nothing. Do not re-add a message
 * here without an emit site in packages/api/src/bot/commands.ts.
 */
export const DEFAULT_TIMER_MESSAGES = {
  notRunning: "The timer isn't running. Start it first.",
  wrongCommand: "Didn't catch that. Try !timer start, pause, resume, skip, reset, or eta.",
  timerRunning: "The timer is already running.",
  commandSuccess: "Done.",
  cycleWrong: "Pick a cycle count from 1 to 99, like !timer start 4.",
  eta: "This phase ends in {phase} · the session ends in {time}",
};

/**
 * The bot_config `msg_*` column DEFAULTs exactly as the applied migrations wrote
 * them. FROZEN: SQLite cannot change a column default without rebuilding the
 * table, and D1 migrations here are expand-only, so these never change. A fresh
 * row starts with these strings and is upgraded on read like any other legacy
 * default. Only the schema (packages/db/src/schema/app.ts) reads them.
 */
export const TASK_MESSAGE_COLUMN_DEFAULTS = {
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
} satisfies Record<keyof typeof DEFAULT_TASK_MESSAGES, string>;

export const TIMER_MESSAGE_COLUMN_DEFAULTS = {
  notRunning: "The timer isn't howling yet! Start it up first.",
  wrongCommand:
    "My ears didn't catch that... Try !timer start, pause, resume, skip, reset, or eta.",
  timerRunning: "The hunt is already in progress!",
  commandSuccess: "Paw-fect! Done!",
  cycleWrong: "That cycle count won't work — pick 1 to 99, like !timer start 4.",
  eta: "This phase ends in {phase} · the hunt is done in {time}",
} satisfies Record<keyof typeof DEFAULT_TIMER_MESSAGES, string>;

/**
 * Every default wording a bot_config row may still hold from an earlier release,
 * per message, other than the frozen column default above: the original
 * Node/Postgres build (prisma migration 0002_bot_settings_overhaul) and the
 * first Workers builds. `buildBotConfig` treats a stored value matching any of
 * these as "never customized". Append, never remove.
 */
export const LEGACY_TASK_MESSAGES: Record<keyof typeof DEFAULT_TASK_MESSAGES, readonly string[]> = {
  taskAdded: [],
  noTaskAdded: ["You're already on the hunt {user}, use !check to see your current task!"],
  noTaskContent: [
    "Tell the pack what you're working on! Use !add [task] {user}",
    "Tell the pack what you're working on! Use !task [task] {user}",
  ],
  noTaskToEdit: ["No task found in your den to edit {user}"],
  taskEdited: [],
  taskRemoved: [],
  taskNext: [],
  adminDeleteTasks: [],
  taskDone: [],
  taskCheck: ['{user}, your current scent is on: "{task}"'],
  taskCheckUser: [],
  noTask: ["Looks like you aren't tracking anything in the forest right now, {user}"],
  noTaskOther: ["The scent is cold... there is no task from that user {user}"],
  notMod: ["Grrr! Permission denied, {user}; Only pack leaders (mods) can do that."],
  clearedAll: [],
  clearedDone: [],
  nextNoContent: ["Don't leave the pack hanging! Try !next [task] {user}"],
  help: ["{user} Join the hunt with !task, !remove, !edit, or !done."],
};

export const LEGACY_TIMER_MESSAGES: Record<keyof typeof DEFAULT_TIMER_MESSAGES, readonly string[]> =
  {
    notRunning: [],
    wrongCommand: ["My ears didn't catch that... Command not recognized!"],
    timerRunning: [],
    commandSuccess: [],
    cycleWrong: ["The cycle cannot outrun the goal!"],
    eta: ["The hunt will end at {time}"],
  };
