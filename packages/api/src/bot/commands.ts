import type { DbClient } from "@dirework/db";

import { interpolate } from "../chat-text";
import type { BotConfigData } from "../config-shared";
import {
  CHAT_OPEN_TASK_CAP,
  cleanChatLine,
  isBuiltinCommandName,
  MAX_BLOCKED_VIEWERS,
  MAX_CHAT_BYTES,
  MAX_TASK_LEN,
  MODERATION_COMMANDS,
  normalizeAliasToken,
  normalizeTwitchLogin,
  replaceControlCharacters,
  truncateToBytes,
  truncateToLength,
  utf8ByteLength,
} from "../config-shared";
import { blockViewer, setBotMuted, streamerLogin, unblockViewer } from "../services/bot-moderation";
import {
  activateTask,
  clearAllTasks,
  clearDoneTasks,
  createTask,
  editTask,
  findActiveTaskByUsername,
  getActiveTask,
  getViewerOpenTasks,
  markTaskDone,
  removeTask,
  replaceActiveTask,
  removeTasksByUsername,
} from "../services/task-service";
import {
  getTimerEta,
  getTimerState,
  pauseTimerWithResult,
  resetTimer,
  resumeTimerWithResult,
  skipTimerWithResult,
  startTimer,
} from "../services/timer-service";
import {
  COMMAND_HELP_LINES,
  DW_GUIDE_REPLY,
  DW_TASKS_OFF_REPLY,
  DW_TIMER_OFF_REPLY,
  DW_UNKNOWN_REPLY,
  parseDwArgs,
} from "./viewer-help";

// Chat command handling for the browser-bot ingest path. This module is pure
// with respect to the runtime: no env, no event bus — all state changes go
// through the shared services (audit M1), and replies go through `say`.

export interface ChatUserInfo {
  twitchId: string;
  username: string;
  displayName: string;
  color: string | null;
  isBroadcaster: boolean;
  isMod: boolean;
}

export interface MessageContext {
  db: DbClient;
  channelName: string;
  /**
   * The streamer's real Twitch login as cached on instance_config (null before
   * the bot page first resolved it). `channelName` is the owner's name, which
   * can be a display name, so !block compares against this.
   */
  channelLogin?: string | null;
  /**
   * The owner's stats time zone, read with the bot token gate (null = UTC). Passed
   * to every service that records dashboard stats, so a chat line adds no
   * instance_config read; undefined (tests, other callers) reads it when needed.
   */
  timeZone?: string | null;
  config: BotConfigData;
  message: string;
  userInfo: ChatUserInfo;
  /** Docs site base URL for !dwhelp (injected by the caller — keeps this module env-free). */
  docsUrl?: string;
  say: (text: string) => void;
  /**
   * Claim the message for processing, awaited only once it resolves to an
   * enabled Dirework command (so other bots' `!` commands cost no writes).
   * Resolving false means another bot page already handled it.
   */
  claim?: () => Promise<boolean>;
}

// Template rendering lives in ../chat-text (zod-free) so the dashboard previews a reply with
// the exact function the bot sends with. Re-exported here for the callers and tests that have
// always imported it from the command module.
export { interpolate };

/**
 * Format a millisecond duration as a compact chat-friendly string ("18m",
 * "1h 55m"). Rounds up to the next whole minute and never goes below "1m" —
 * the Worker runs in UTC, so ETA announcements must be relative, not
 * wall-clock times.
 */
export function formatEtaDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * A 1-based task position arg ("!done 2", "!remove #1", …) as a number, or
 * null when the arg isn't one. One leading "#" is accepted because `!today`
 * shows positions as "#2", so viewers type them back that way.
 */
export function parsePositionArg(arg: string | undefined): number | null {
  const match = arg == null ? null : /^#?(\d{1,6})$/.exec(arg);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/** `!edit <position> <new text>`, or null when either part is missing. */
export function parseTaskEditArgs(args: string[]): { position: number; text: string } | null {
  const position = parsePositionArg(args[0]);
  if (args.length < 2 || position === null) return null;
  const text = truncateToLength(args.slice(1).join(" ").trim(), MAX_TASK_LEN);
  return text ? { position, text } : null;
}

/**
 * A `@user` command target ("!check @Viewer?", "!clear @viewer,") as the
 * lowercase login, through the same normalizer !block uses. Trailing sentence
 * punctuation is dropped first, since chat often types the name mid-sentence;
 * anything that still isn't a Twitch login is null.
 */
export function parseUserTarget(arg: string): string | null {
  return normalizeTwitchLogin(arg.replace(/[.,!?;:]+$/, ""));
}

/**
 * Hardcoded bad-usage replies (like the !dwhelp fallback): no owner template
 * fits "you left out the number", and config.task.noTask would be wrong for a
 * viewer who has tasks. Static on purpose: reading the viewer's tasks just to
 * word a hint would add a D1 round trip to the ingest path (AGENTS.md cost
 * rules). `!today` is where a viewer sees their task numbers.
 */
const POSITIONAL_USAGE_REPLY = (command: string, displayName: string) =>
  `Which task, ${displayName}? Use ${command} [number]. !today lists your open tasks with their numbers.`;

const CLEAR_USAGE_REPLY = (displayName: string) =>
  `${displayName}, tell me what to clear: !clear done, !clear all, or !clear @user.`;

const DONE_USAGE_REPLY = (displayName: string) =>
  `${displayName}, use !done to finish your current task, or !done [number] for another one. !today lists the numbers.`;

const CHECK_USAGE_REPLY = (displayName: string) =>
  `${displayName}, use !check for your own task or !check @user for someone else's.`;

/** `login` is never "@"-prefixed, like the moderation replies below. */
const NOTHING_TO_CLEAR_REPLY = (login: string) => `${login} has no tasks to clear.`;

// Timer no-op replies: fixed like the usage replies above, because the owner's
// templates only cover "not running" and "already running".
const TIMER_ALREADY_PAUSED_REPLY = "The timer is already paused. Use !timer resume to continue.";
const TIMER_CHANGED_REPLY =
  "The timer changed just before that, so I left it alone. Check it and try again.";
const TIMER_PAUSED_ETA_REPLY = (phase: string, time: string) =>
  `The timer is paused with ${phase} left in this phase and ${time} left in the session.`;

// Moderation replies are fixed like CLEAR_USAGE_REPLY: they report bot state, not
// a viewer's task, so there is no owner template to fill. `name` is the mod's
// display name; a target login is never "@"-prefixed, so a reply can't ping a
// viewer who was just blocked.
const MUTED_REPLY = "Muted. I'll ignore commands and stay quiet until a mod sends !unmute.";
const UNMUTED_REPLY = "Unmuted. Commands are back on.";
const NOT_MUTED_REPLY = (name: string) => `${name}, I'm not muted.`;
const BLOCK_USAGE_REPLY = (name: string) => `${name}, tell me who to block: !block @user.`;
const UNBLOCK_USAGE_REPLY = (name: string) => `${name}, tell me who to unblock: !unblock @user.`;
const BLOCK_BROADCASTER_REPLY = (name: string) => `${name}, I can't block the streamer.`;
const BLOCKED_REPLY = (login: string) => `Blocked ${login} and removed their tasks.`;
const ALREADY_BLOCKED_REPLY = (login: string) => `${login} is already blocked.`;
const BLOCKLIST_FULL_REPLY = (name: string) =>
  `${name}, the block list is full (${MAX_BLOCKED_VIEWERS} names). Unblock someone first.`;
const UNBLOCKED_REPLY = (login: string) => `Unblocked ${login}. Their commands work again.`;
const NOT_BLOCKED_REPLY = (login: string) => `${login} isn't blocked.`;

/** Hardcoded like POSITIONAL_USAGE_REPLY: no owner template fits "retry". */
const STALE_NEXT_REPLY = (displayName: string) =>
  `Your current task changed before I could replace it, ${displayName}. Check it with !check and try !next again.`;

/**
 * Resolve a 1-based position arg to the viewer's nth open task — the lookup
 * every positional task command (!done/!edit/!remove/!focus) repeats. Returns
 * null when the position is out of range.
 */
async function getTaskAtPosition(db: DbClient, twitchId: string, position: number) {
  const viewerTasks = await getViewerOpenTasks(db, twitchId);
  return viewerTasks[position - 1] ?? null;
}

/**
 * Resolve a chat command through the configured aliases. Stored keys/targets are
 * normalized (leading "!" stripped, lowercased) via the shared normalizer, so
 * both canonical `{ t: "task" }` and legacy `{ "!t": "!task" }` records resolve
 * `!t` → `!task` — never the old `!!task`. The incoming command is kept verbatim
 * and only matched against `!<normalized-key>`, so a bare "focus" (no "!") is not
 * a command and stays unchanged.
 */
export function resolveAlias(command: string, aliases: Record<string, string>): string {
  const cmd = command.toLowerCase();
  // Built-in names always run the built-in, even if an alias stored before
  // validation rejected them claims the name.
  if (isBuiltinCommandName(cmd.slice(1))) return command;
  for (const [alias, target] of Object.entries(aliases)) {
    if (cmd === `!${normalizeAliasToken(alias)}`) {
      return `!${normalizeAliasToken(target)}`;
    }
  }
  return command;
}

const TASK_COMMANDS = new Set([
  "!task",
  "!done",
  "!edit",
  "!remove",
  "!focus",
  "!check",
  "!today",
  "!next",
  "!help",
  "!clear",
]);

/** `!mute`, `!unmute`, `!block`, `!unblock` — mod-only, never alias targets. */
const MODERATION_COMMAND_SET = new Set<string>(MODERATION_COMMANDS.map((name) => `!${name}`));

/** The bot's mute state after a message ran, reported back to the bot page. */
interface ModerationState {
  muted: boolean;
}

/**
 * Run one chat line. Resolves to the mute state AFTER the command, so the bot
 * page can show "Muted" without another request.
 */
export async function handleMessage(ctx: MessageContext): Promise<ModerationState> {
  const state: ModerationState = { muted: ctx.config.muted === true };
  await dispatchMessage(ctx, state);
  return state;
}

async function dispatchMessage(ctx: MessageContext, state: ModerationState): Promise<void> {
  const { config, userInfo, say, channelName } = ctx;
  const claim = async () => (ctx.claim ? ctx.claim() : true);
  const message = cleanChatLine(ctx.message);

  if (!message.startsWith("!")) return;

  const parts = message.split(/\s+/);
  if (!parts[0]) return;
  let command = parts[0].toLowerCase();
  const args = parts.slice(1);

  command = resolveAlias(command, config.commandAliases);

  // Moderation gate, BEFORE any claim(): an ignored line costs no write and gets
  // no reply. The broadcaster can never be blocked; while muted, only a mod's
  // !unmute gets through.
  if (!userInfo.isBroadcaster && config.blockedViewers.includes(userInfo.username.toLowerCase())) {
    return;
  }
  if (state.muted && !(command === "!unmute" && userInfo.isMod)) return;

  const vars = {
    user: userInfo.displayName,
    channel: channelName,
  };

  if (MODERATION_COMMAND_SET.has(command)) {
    if (!(await claim())) return;
    if (!userInfo.isMod) {
      say(interpolate(config.task.notMod, vars));
      return;
    }
    await handleModerationCommand(command, args, ctx, state);
    return;
  }

  if (command === "!timer") {
    if (!config.timerCommandsEnabled) return;
    if (!(await claim())) return;
    if (!userInfo.isMod) {
      say(interpolate(config.task.notMod, vars));
      return;
    }
    await handleTimerCommand(args, ctx);
    return;
  }

  if (command === "!dwhelp" || command === "!dwcommands") {
    if (!(await claim())) return;
    sayCommandList(ctx);
    return;
  }

  // The `!dw` help namespace: always on like !dwhelp, answered from the config
  // bot.ingest already loaded (no D1 read or write past the claim).
  if (command === "!dw") {
    if (!(await claim())) return;
    handleDwCommand(args, ctx);
    return;
  }

  if (!config.taskCommandsEnabled || !TASK_COMMANDS.has(command)) return;
  if (!(await claim())) return;

  switch (command) {
    case "!task":
      await handleTaskAdd(args, ctx);
      break;
    case "!done":
      await handleTaskDone(args, ctx);
      break;
    case "!edit":
      await handleTaskEdit(args, ctx);
      break;
    case "!remove":
      await handleTaskRemove(args, ctx);
      break;
    case "!focus":
      await handleTaskFocus(args, ctx);
      break;
    case "!check":
      await handleTaskCheck(args, ctx);
      break;
    case "!today":
      await handleTaskToday(ctx);
      break;
    case "!next":
      await handleTaskNext(args, ctx);
      break;
    case "!help":
      say(interpolate(config.task.help, vars));
      break;
    case "!clear":
      await handleClear(args, ctx);
      break;
  }
}

/** `!dwhelp`, `!dwcommands` and `!dw commands`: the docs page, or an inline list without one. */
function sayCommandList(ctx: MessageContext): void {
  const name = ctx.userInfo.displayName;
  if (ctx.docsUrl) {
    ctx.say(`${name}, the full command list is here: ${ctx.docsUrl}/docs/chat-commands`);
  } else {
    ctx.say(
      `${name}, available commands: !dw help, !task, !done, !edit, !remove, !focus, !check, !today, !next, !help, !clear (mods), !timer (mods), !block, !unblock, !mute, !unmute (mods)`,
    );
  }
}

/** `!dw`, `!dw help`, `!dw help <command>`, `!dw commands` (see bot/viewer-help.ts). */
function handleDwCommand(args: string[], ctx: MessageContext): void {
  const { config, userInfo, say } = ctx;
  const name = userInfo.displayName;
  const request = parseDwArgs(args, (command) => resolveAlias(command, config.commandAliases));

  if (request.kind === "commands") {
    sayCommandList(ctx);
    return;
  }
  if (request.kind === "guide") {
    say(config.taskCommandsEnabled ? DW_GUIDE_REPLY(name) : DW_TASKS_OFF_REPLY(name));
    return;
  }
  if (!request.name) {
    say(DW_UNKNOWN_REPLY(name));
    return;
  }
  // Don't explain a command that won't answer right now.
  if (!config.taskCommandsEnabled && TASK_COMMANDS.has(`!${request.name}`)) {
    say(DW_TASKS_OFF_REPLY(name));
    return;
  }
  if (!config.timerCommandsEnabled && request.name === "timer") {
    say(DW_TIMER_OFF_REPLY(name));
    return;
  }
  say(`${name}, ${COMMAND_HELP_LINES[request.name]}`);
}

const TODAY_PREVIEW_BYTES = 100;
const TODAY_TASK_LIMIT = 3;

function todayTaskPreview(text: string): string {
  const clean = replaceControlCharacters(text).replace(/\s+/g, " ").trim();
  if (utf8ByteLength(clean) <= TODAY_PREVIEW_BYTES) return clean;
  const ellipsis = "…";
  return `${truncateToBytes(clean, TODAY_PREVIEW_BYTES - utf8ByteLength(ellipsis))}${ellipsis}`;
}

/**
 * A short personal plan: current focus, the next two tasks, and a remaining count.
 * Each task carries its 1-based position in `tasks` (the viewer's open list in
 * list order), which is the number `!done`, `!edit`, `!remove` and `!focus` take —
 * the only place in chat a viewer can see those numbers.
 */
export function formatTodayPlan(
  displayName: string,
  tasks: readonly { text: string; status: string }[],
): string {
  const numbered = tasks.map((task, index) => ({ ...task, position: index + 1 }));
  const active = numbered.find((task) => task.status === "active");
  const ordered = active ? [active, ...numbered.filter((task) => task !== active)] : numbered;
  const shown = ordered.slice(0, TODAY_TASK_LIMIT);
  let queuedCount = 0;
  const items = shown.map((task) => {
    const label = task.status === "active" ? "Now" : queuedCount++ === 0 ? "Next" : "Then";
    return `${label}: #${task.position} ${todayTaskPreview(task.text)}`;
  });
  const remaining = ordered.length - shown.length;
  if (remaining > 0) items.push(`+${remaining} more`);

  const message = `${displayName}'s plan: ${items.join(" · ")}`;
  return utf8ByteLength(message) <= MAX_CHAT_BYTES
    ? message
    : `${truncateToBytes(message, MAX_CHAT_BYTES - utf8ByteLength("…"))}…`;
}

async function handleTaskToday(ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const tasks = await getViewerOpenTasks(db, userInfo.twitchId);
  if (tasks.length === 0) {
    say(interpolate(config.task.noTask, { user: userInfo.displayName, channel: ctx.channelName }));
    return;
  }
  say(formatTodayPlan(userInfo.displayName, tasks));
}

async function handleTaskAdd(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  // L1: the chat path enforces the same MAX_TASK_LEN as the tRPC schema.
  const text = truncateToLength(args.join(" ").trim(), MAX_TASK_LEN);
  const vars = { user: userInfo.displayName, channel: ctx.channelName, task: text };

  if (!text) {
    say(interpolate(config.task.noTaskContent, vars));
    return;
  }

  // L1: per-user open-task cap on the chat path.
  const openTasks = await getViewerOpenTasks(db, userInfo.twitchId);
  if (openTasks.length >= CHAT_OPEN_TASK_CAP) {
    say(interpolate(config.task.noTaskAdded, vars));
    return;
  }

  // isBroadcaster was derived from the owner row bot.ingest already read, so
  // createTask doesn't read it again for this chat line.
  await createTask(db, userInfo, text, {
    openTaskCount: openTasks.length,
    isBroadcaster: userInfo.isBroadcaster,
  });
  say(interpolate(config.task.taskAdded, vars));
}

async function handleTaskDone(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  // A bare !done finishes the active task. Anything else must be a position:
  // falling back to the active task for "!done intro" would complete the
  // wrong task and announce it.
  const position = parsePositionArg(args[0]);
  if (args[0] !== undefined && position === null) {
    say(DONE_USAGE_REPLY(userInfo.displayName));
    return;
  }

  const task =
    position !== null
      ? await getTaskAtPosition(db, userInfo.twitchId, position)
      : await getActiveTask(db, userInfo.twitchId);

  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await markTaskDone(db, task.id, { timeZone: ctx.timeZone });
  say(interpolate(config.task.taskDone, { ...vars, task: task.text }));
}

async function handleTaskEdit(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  const edit = parseTaskEditArgs(args);
  if (!edit) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  const task = await getTaskAtPosition(db, userInfo.twitchId, edit.position);
  if (!task) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  await editTask(db, task.id, edit.text);
  say(interpolate(config.task.taskEdited, { ...vars, task: edit.text }));
}

async function handleTaskRemove(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  const position = parsePositionArg(args[0]);
  if (position === null) {
    say(POSITIONAL_USAGE_REPLY("!remove", userInfo.displayName));
    return;
  }

  const task = await getTaskAtPosition(db, userInfo.twitchId, position);
  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await removeTask(db, task.id);
  say(interpolate(config.task.taskRemoved, { ...vars, task: task.text }));
}

async function handleTaskFocus(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  const position = parsePositionArg(args[0]);
  if (position === null) {
    say(POSITIONAL_USAGE_REPLY("!focus", userInfo.displayName));
    return;
  }

  const task = await getTaskAtPosition(db, userInfo.twitchId, position);
  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await activateTask(db, task);
  say(interpolate(config.task.taskCheck, { ...vars, task: task.text }));
}

async function handleTaskCheck(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  // Any argument is a target, "@" or not: ignoring "!check viewer" and showing
  // the sender's own task instead answered a question nobody asked.
  if (args[0] !== undefined) {
    const target = parseUserTarget(args[0]);
    if (!target) {
      say(CHECK_USAGE_REPLY(userInfo.displayName));
      return;
    }
    const targetTask = await findActiveTaskByUsername(db, target);

    if (!targetTask) {
      say(interpolate(config.task.noTaskOther, vars));
      return;
    }

    say(
      interpolate(config.task.taskCheckUser, {
        ...vars,
        user2: targetTask.authorDisplayName,
        task: targetTask.text,
      }),
    );
    return;
  }

  const activeTask = await getActiveTask(db, userInfo.twitchId);

  if (!activeTask) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  say(interpolate(config.task.taskCheck, { ...vars, task: activeTask.text }));
}

async function handleTaskNext(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const newText = truncateToLength(args.join(" ").trim(), MAX_TASK_LEN);
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!newText) {
    say(interpolate(config.task.nextNoContent, vars));
    return;
  }

  // One read: the open list already holds the active task (the partial unique
  // index guarantees at most one), so a separate getActiveTask is redundant.
  const openTasks = await getViewerOpenTasks(db, userInfo.twitchId);
  const activeTask = openTasks.find((task) => task.status === "active") ?? null;

  // L1: cap counts against the state AFTER the active task completes.
  if (openTasks.length - (activeTask ? 1 : 0) >= CHAT_OPEN_TASK_CAP) {
    say(interpolate(config.task.noTaskAdded, vars));
    return;
  }

  // No active task means there is no {oldTask} to announce — fall back to the
  // plain taskAdded template instead of interpolating empty quotes.
  if (!activeTask) {
    await createTask(db, userInfo, newText, {
      activate: true,
      isBroadcaster: userInfo.isBroadcaster,
    });
    say(interpolate(config.task.taskAdded, { ...vars, task: newText }));
    return;
  }

  const result = await replaceActiveTask(db, activeTask, userInfo, newText, {
    isBroadcaster: userInfo.isBroadcaster,
    timeZone: ctx.timeZone,
  });
  if (!result.created) {
    // The active task was completed or removed after we read it, so the guarded
    // batch created nothing — don't announce a replacement that never happened.
    say(STALE_NEXT_REPLY(userInfo.displayName));
    return;
  }
  say(
    interpolate(config.task.taskNext, {
      ...vars,
      oldTask: activeTask.text,
      newTask: newText,
    }),
  );
}

async function handleClear(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!userInfo.isMod) {
    say(interpolate(config.task.notMod, vars));
    return;
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "all") {
    await clearAllTasks(db);
    say(interpolate(config.task.clearedAll, vars));
  } else if (sub === "done") {
    await clearDoneTasks(db);
    say(interpolate(config.task.clearedDone, vars));
  } else if (sub?.startsWith("@")) {
    // "@" is required here (unlike !check): a typo like "!clear dones" must not
    // delete the tasks of a viewer called "dones".
    const target = parseUserTarget(sub);
    if (!target) {
      say(CLEAR_USAGE_REPLY(userInfo.displayName));
      return;
    }
    const removed = await removeTasksByUsername(db, target);
    say(
      removed > 0
        ? interpolate(config.task.adminDeleteTasks, vars)
        : NOTHING_TO_CLEAR_REPLY(target),
    );
  } else {
    // A mod typed !clear with no target (or an unknown one): say what the targets are
    // instead of silently doing nothing.
    say(CLEAR_USAGE_REPLY(userInfo.displayName));
  }
}

async function handleModerationCommand(
  command: string,
  args: string[],
  ctx: MessageContext,
  state: ModerationState,
): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const name = userInfo.displayName;

  switch (command) {
    case "!mute":
      await setBotMuted(db, true);
      state.muted = true;
      say(MUTED_REPLY);
      return;

    case "!unmute":
      if (!state.muted) {
        say(NOT_MUTED_REPLY(name));
        return;
      }
      await setBotMuted(db, false);
      state.muted = false;
      say(UNMUTED_REPLY);
      return;

    case "!block": {
      const target = normalizeTwitchLogin(args[0] ?? "");
      if (!target) {
        say(BLOCK_USAGE_REPLY(name));
        return;
      }
      if (target === streamerLogin(ctx.channelLogin, ctx.channelName)) {
        say(BLOCK_BROADCASTER_REPLY(name));
        return;
      }
      // Answered from the row bot.ingest already loaded: no write for a repeat.
      if (config.blockedViewers.includes(target)) {
        say(ALREADY_BLOCKED_REPLY(target));
        return;
      }
      if (config.blockedViewers.length >= MAX_BLOCKED_VIEWERS) {
        say(BLOCKLIST_FULL_REPLY(name));
        return;
      }
      // The guarded append can still no-op if another write raced the snapshot
      // above; never announce a block that didn't happen.
      const result = await blockViewer(db, target);
      if (result.added) say(BLOCKED_REPLY(target));
      else if (result.reason === "already-blocked") say(ALREADY_BLOCKED_REPLY(target));
      else say(BLOCKLIST_FULL_REPLY(name));
      return;
    }

    case "!unblock": {
      const target = normalizeTwitchLogin(args[0] ?? "");
      if (!target) {
        say(UNBLOCK_USAGE_REPLY(name));
        return;
      }
      if (!config.blockedViewers.includes(target)) {
        say(NOT_BLOCKED_REPLY(target));
        return;
      }
      await unblockViewer(db, target);
      say(UNBLOCKED_REPLY(target));
      return;
    }
  }
}

async function handleTimerCommand(args: string[], ctx: MessageContext): Promise<void> {
  const { config, say, db, channelName, userInfo } = ctx;
  const stats = { timeZone: ctx.timeZone };
  const sub = args[0]?.toLowerCase();
  const vars = { user: userInfo.displayName, channel: channelName };

  switch (sub) {
    case "start": {
      const timer = await getTimerState(db, stats);
      if (timer && timer.status !== "idle" && timer.status !== "finished") {
        say(interpolate(config.timer.timerRunning, vars));
        return;
      }

      let totalCycles: number | undefined;
      if (args[1]) {
        const parsed = /^\d+$/.test(args[1]) ? parseInt(args[1], 10) : NaN;
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
          say(interpolate(config.timer.cycleWrong, vars));
          return;
        }
        totalCycles = parsed;
      }

      await startTimer(db, { totalCycles });
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "pause": {
      const result = await pauseTimerWithResult(db, stats);
      if (result.changed) say(interpolate(config.timer.commandSuccess, vars));
      else if (result.reason === "already-paused") say(TIMER_ALREADY_PAUSED_REPLY);
      else if (result.reason === "lost-race") say(TIMER_CHANGED_REPLY);
      else say(interpolate(config.timer.notRunning, vars));
      break;
    }

    case "resume": {
      const result = await resumeTimerWithResult(db, stats);
      if (result.changed) say(interpolate(config.timer.commandSuccess, vars));
      else if (result.reason === "not-paused") say(interpolate(config.timer.timerRunning, vars));
      else if (result.reason === "lost-race") say(TIMER_CHANGED_REPLY);
      else say(interpolate(config.timer.notRunning, vars));
      break;
    }

    case "skip": {
      const result = await skipTimerWithResult(db, stats);
      if (result.changed) say(interpolate(config.timer.commandSuccess, vars));
      else if (result.reason === "lost-race") say(TIMER_CHANGED_REPLY);
      else say(interpolate(config.timer.notRunning, vars));
      break;
    }

    case "reset": {
      await resetTimer(db, stats);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "eta": {
      const eta = await getTimerEta(db, stats);
      if (!eta) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      // Relative durations, not wall-clock times — the Worker has no idea
      // what timezone the channel is in (Date#toLocaleTimeString is UTC here).
      const now = Date.now();
      const phase = formatEtaDuration(eta.phaseEnd.getTime() - now);
      const time = formatEtaDuration(eta.sessionEnd.getTime() - now);
      // Paused: the owner's template says "ends in", which isn't true while the
      // clock is frozen, so report the frozen time left instead.
      say(
        eta.paused
          ? TIMER_PAUSED_ETA_REPLY(phase, time)
          : interpolate(config.timer.eta, { ...vars, phase, time }),
      );
      break;
    }

    default:
      say(interpolate(config.timer.wrongCommand, vars));
  }
}
