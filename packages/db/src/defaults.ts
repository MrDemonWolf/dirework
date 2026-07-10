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
  noTaskAdded: "You're already on the hunt {user}, use !check to see your current task!",
  noTaskContent: "Tell the pack what you're working on! Use !task [task] {user}",
  noTaskToEdit: "No task found in your den to edit {user}",
  taskEdited: 'The hunt has changed! Task updated to "{task}" {user}',
  taskRemoved: 'Task "{task}" has been scent-wiped from the list, {user}',
  taskNext: "Paws-ome work finishing '{oldTask}'! Now tracking '{newTask}', {user}!",
  adminDeleteTasks: "All of the user's tasks have been cleared from the forest.",
  taskDone: 'Alpha work! You finished "{task}" {user}!',
  taskCheck: '{user}, your current scent is on: "{task}"',
  taskCheckUser: '{user}, {user2} is currently tracking: "{task}"',
  noTask: "Looks like you aren't tracking anything in the forest right now, {user}",
  noTaskOther: "The scent is cold... there is no task from that user {user}",
  notMod: "Grrr! Permission denied, {user}; Only pack leaders (mods) can do that.",
  clearedAll: "The forest has been cleared of all tasks!",
  clearedDone: "All finished tasks have been cleared from the den!",
  nextNoContent: "Don't leave the pack hanging! Try !next [task] {user}",
  help: "{user} Join the hunt with !task, !remove, !edit, or !done.",
};

/** Default timer chat messages (bot_config msg_* columns). */
export const DEFAULT_TIMER_MESSAGES = {
  workMsg: "Time to hunt some code! Focus mode activated!",
  breakMsg: "Paws up! Time for a short rest in the den.",
  longBreakMsg: "The whole pack is taking a long snooze! Back soon!",
  workRemindMsg: "Get ready to howl at that code @{channel}, focus starts in 25 seconds!",
  notRunning: "The timer isn't howling yet! Start it up first.",
  streamStarting: "The Blue Wolf is waking up! Stream starting!",
  wrongCommand: "My ears didn't catch that... Command not recognized!",
  timerRunning: "The hunt is already in progress!",
  commandSuccess: "Paw-fect! Done!",
  cycleWrong: "The cycle cannot outrun the goal!",
  goalWrong: "The goal needs to be further than the cycle!",
  finishResponse: "Great work today pack! We hunted well.",
  alreadyStarting: "The pack is already moving or the timer is running!",
  eta: "This phase ends in {phase} · the hunt is done in {time}",
};
