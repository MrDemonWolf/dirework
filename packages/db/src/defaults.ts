// ── Single source of default config values ──────────────────────────────────
// Pure data — NO drizzle/env imports. Referenced by:
//   - the schema column defaults (packages/db/src/schema/app.ts)
//   - @dirework/api config-defaults (DEFAULT_* re-exports used by apps/web)
//   - @dirework/api timer-logic (DEFAULTS fallback when no config row exists)
// Changing a value that feeds a schema column default changes the drizzle
// snapshot → regenerate a migration with `bun run db:generate`. The bot message
// and overlay style defaults are the exception: the schema reads the frozen
// *_MESSAGE_COLUMN_DEFAULTS / *_STYLE_COLUMN_DEFAULTS, and what the app uses
// (DEFAULT_*_MESSAGES / DEFAULT_*_STYLES) can change freely.

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
  // The viewer starter guide. Its three steps match STARTER_STEPS in
  // packages/api/src/bot/viewer-help.ts (the built-in `!dw help` guide); a test pins it.
  help: "{user}, here's how it works: 1) Type !task and what you're working on, like !task read 10 pages. 2) Work along with the stream. 3) Type !done when you finish. Need more? Type !dw help",
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
  help: [
    "{user} Join the hunt with !task, !remove, !edit, or !done.",
    "{user}, commands: !task, !done, !edit, !remove, !focus, !check, !today, !next. Full list: !dwhelp",
  ],
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

// ── Overlay style defaults ──────────────────────────────────────────────────

/**
 * The timer_style column DEFAULTs exactly as the applied migrations wrote them.
 * FROZEN for the same reason as the message column defaults above: a fresh row
 * starts with these values and `buildTimerStylesConfig` (@dirework/api
 * config-shared) reads them back as DEFAULT_TIMER_STYLES. Only the schema and
 * that read-time upgrade use them.
 */
export const TIMER_STYLE_COLUMN_DEFAULTS = {
  width: "300px",
  height: "300px",
  bgColor: "#091533",
  bgOpacity: 0.85,
  bgBorderRadius: "22%",
  ringEnabled: true,
  ringTrackColor: "#ffffff",
  ringTrackOpacity: 0.18,
  ringFillColor: "#00aced",
  ringFillOpacity: 1,
  ringWidth: 8,
  ringGap: 6,
  textColor: "#ffffff",
  textOutlineColor: "#000000",
  textOutlineSize: "0px",
  textFontFamily: "Montserrat",
  fontSizeLabel: "18px",
  fontSizeTime: "48px",
  fontSizeCycle: "16px",
} as const;

/** The task_style column DEFAULTs as the applied migrations wrote them. FROZEN. */
export const TASK_STYLE_COLUMN_DEFAULTS = {
  displayShowDone: true,
  displayShowCount: true,
  displayUseCheckboxes: true,
  displayCrossOnDone: true,
  displayNumberOfLines: 2,
  fontHeader: "Montserrat",
  fontBody: "Roboto",
  scrollEnabled: true,
  scrollPixelsPerSecond: 40,
  scrollGapBetweenLoops: 100,
  headerHeight: "52px",
  headerBgColor: "#091533",
  headerBgOpacity: 0.95,
  headerBorderColor: "#1b2b52",
  headerBorderWidth: "1px",
  headerBorderRadius: "12px 12px 0 0",
  headerFontSize: "24px",
  headerFontColor: "#ffffff",
  headerPadding: "12px 16px",
  bodyBgColor: "#091533",
  bodyBgOpacity: 0.85,
  bodyBorderColor: "#1b2b52",
  bodyBorderWidth: "1px",
  bodyBorderRadius: "0 0 12px 12px",
  bodyPaddingVertical: "6px",
  bodyPaddingHorizontal: "6px",
  taskBgColor: "#12244a",
  taskBgOpacity: 0.9,
  taskBorderColor: "#1b2b52",
  taskBorderWidth: "0px",
  taskBorderRadius: "10px",
  taskFontSize: "22px",
  taskFontColor: "#eaf2ff",
  taskUsernameColor: "#6b8bf5",
  taskPadding: "10px 14px",
  taskMarginBottom: "4px",
  taskMaxWidth: "100%",
  taskDoneBgColor: "#091533",
  taskDoneBgOpacity: 0.5,
  taskDoneFontColor: "#7c8db0",
  checkboxSize: "20px",
  checkboxBgColor: "#000000",
  checkboxBgOpacity: 0,
  checkboxBorderColor: "#4a5b82",
  checkboxBorderWidth: "2px",
  checkboxBorderRadius: "6px",
  checkboxMarginTop: "4px",
  checkboxMarginLeft: "2px",
  checkboxMarginRight: "8px",
  checkboxTickChar: "✔",
  checkboxTickSize: "14px",
  checkboxTickColor: "#00aced",
  bulletChar: "•",
  bulletSize: "20px",
  bulletColor: "#7c8db0",
  bulletMarginTop: "0px",
  bulletMarginLeft: "2px",
  bulletMarginRight: "8px",
} as const;

/** A stored overlay style column value. */
export type StyleColumnValue = string | number | boolean;

/**
 * Every earlier default a timer_style column may still hold, other than the
 * frozen column default above. Whenever a DEFAULT_TIMER_STYLES value changes,
 * append the value it replaced here (keyed by column), or instances still on the
 * old default keep it. Append, never remove.
 */
export const LEGACY_TIMER_STYLE_VALUES: Partial<
  Record<keyof typeof TIMER_STYLE_COLUMN_DEFAULTS, readonly StyleColumnValue[]>
> = {
  // 24/76/20 (PR #152) ran the countdown to within a few px of the ring at 300×300.
  fontSizeLabel: ["24px"],
  fontSizeTime: ["76px"],
  fontSizeCycle: ["20px"],
};

/** task_style counterpart of LEGACY_TIMER_STYLE_VALUES. Append, never remove. */
export const LEGACY_TASK_STYLE_VALUES: Partial<
  Record<keyof typeof TASK_STYLE_COLUMN_DEFAULTS, readonly StyleColumnValue[]>
> = {};

/**
 * The timer overlay style a never-customized instance renders, and the "Default"
 * Theme Center preset. Nested like the config the API returns. Free to change
 * (it feeds no column default): when a value changes, append the value it
 * replaced to LEGACY_TIMER_STYLE_VALUES.
 */
export const DEFAULT_TIMER_STYLES = {
  dimensions: { width: "300px", height: "300px" },
  background: { color: "#091533", opacity: 0.92, borderRadius: "22%" },
  ring: {
    enabled: true,
    trackColor: "#ffffff",
    trackOpacity: 0.14,
    fillColor: "#00aced",
    fillOpacity: 1,
    width: 14,
    gap: 10,
  },
  text: { color: "#ffffff", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Montserrat" },
  fontSizes: { label: "20px", time: "64px", cycle: "18px" },
};

/** Task overlay counterpart of DEFAULT_TIMER_STYLES (same rules). */
export const DEFAULT_TASK_STYLES = {
  display: {
    showDone: true,
    showCount: true,
    useCheckboxes: true,
    crossOnDone: true,
    numberOfLines: 4,
  },
  fonts: { header: "Montserrat", body: "Roboto" },
  scroll: { enabled: true, pixelsPerSecond: 40, gapBetweenLoops: 100 },
  header: {
    height: "56px",
    background: { color: "#091533", opacity: 0.95 },
    border: { color: "#1b2b52", width: "0px", radius: "14px 14px 0 0" },
    fontSize: "26px",
    fontColor: "#ffffff",
    padding: "12px 18px",
  },
  body: {
    background: { color: "#091533", opacity: 0.9 },
    border: { color: "#1b2b52", width: "0px", radius: "0 0 14px 14px" },
    padding: { vertical: "8px", horizontal: "8px" },
  },
  task: {
    background: { color: "#12244a", opacity: 0.9 },
    border: { color: "#1b2b52", width: "0px", radius: "12px" },
    fontSize: "24px",
    fontColor: "#eaf2ff",
    usernameColor: "#7f9cff",
    padding: "10px 14px",
    marginBottom: "8px",
    maxWidth: "100%",
  },
  taskDone: {
    background: { color: "#091533", opacity: 0.5 },
    fontColor: "#8fa0c2",
  },
  checkbox: {
    size: "20px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#4a5b82", width: "2px", radius: "6px" },
    margin: { top: "4px", left: "2px", right: "8px" },
    tickChar: "✔",
    tickSize: "14px",
    tickColor: "#00aced",
  },
  bullet: {
    char: "•",
    size: "20px",
    color: "#7c8db0",
    margin: { top: "0px", left: "2px", right: "8px" },
  },
};
