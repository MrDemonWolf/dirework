import type { DbClient } from "@dirework/db";

import type { BotConfigData } from "../config-shared";
import {
  CHAT_OPEN_TASK_CAP,
  isBuiltinCommandName,
  MAX_CHAT_BYTES,
  MAX_TASK_LEN,
  normalizeAliasToken,
  truncateToBytes,
  truncateToLength,
  utf8ByteLength,
} from "../config-shared";
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
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
  startTimer,
} from "../services/timer-service";

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

/** A leading character that would make the bot run a chat command. */
const CHAT_COMMAND_LEAD = /^[!./]/;

/** Variables carrying viewer task text — the only ones long enough to overflow a chat line. */
const TASK_TEXT_VARS = ["task", "oldTask", "newTask"] as const;
const ELLIPSIS = "…";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] as string) : match,
  );
}

/**
 * When the filled template exceeds MAX_CHAT_BYTES, shorten the task-text
 * variables (with an ellipsis) so the rest of the template — closing words and
 * the {user} mention — survives instead of being cut off the end by the
 * wire-level truncation.
 */
function fitToChatBytes(template: string, vars: Record<string, string>): string {
  const full = fillTemplate(template, vars);
  if (utf8ByteLength(full) <= MAX_CHAT_BYTES) return full;

  const slots = TASK_TEXT_VARS.flatMap((key) => {
    const value = Object.hasOwn(vars, key) ? vars[key] : undefined;
    const count = template.split(`{${key}}`).length - 1;
    return value === undefined || count === 0 ? [] : [{ key, value, count }];
  });
  if (slots.length === 0) return full;

  const fixed = { ...vars };
  for (const { key } of slots) fixed[key] = "";
  let budget = MAX_CHAT_BYTES - utf8ByteLength(fillTemplate(template, fixed));
  let remaining = slots.reduce((sum, slot) => sum + slot.count, 0);

  // Shortest first, so a short {oldTask} keeps its full text and leaves the
  // rest of the budget to a long {newTask}.
  const bounded = { ...vars };
  const ellipsisBytes = utf8ByteLength(ELLIPSIS);
  slots.sort((a, b) => utf8ByteLength(a.value) - utf8ByteLength(b.value));
  for (const { key, value, count } of slots) {
    const share = Math.floor(budget / remaining);
    const fitted =
      utf8ByteLength(value) <= share
        ? value
        : `${truncateToBytes(value, Math.max(0, share - ellipsisBytes))}${ELLIPSIS}`;
    bounded[key] = fitted;
    budget -= utf8ByteLength(fitted) * count;
    remaining -= count;
  }
  return fillTemplate(template, bounded);
}

/**
 * Fill `{name}` placeholders, bounded to the chat byte cap. A substituted value
 * (viewer task text) must never open the reply with a chat command — `!cmd`
 * would run in other channel bots with this bot's role, `/me` or `.ban` in
 * Twitch itself — so a leading command character the owner's template didn't
 * start with is stripped. Templates that deliberately start with `/me` or `!`
 * keep working.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  const out = fitToChatBytes(template, vars);
  const lead = out.trimStart();
  if (CHAT_COMMAND_LEAD.test(lead) && lead[0] !== template.trimStart()[0]) {
    return lead.replace(/^[!./\s]+/, "");
  }
  return out;
}

/**
 * U+E0000, which Chatterino/7TV append to a repeated message to slip past
 * Twitch's duplicate-message filter. Invisible, so strip it before parsing.
 * Only this code point: the rest of the tag block and ZWJ are legitimate parts
 * of emoji sequences.
 */
const DUPLICATE_BYPASS_SUFFIX = /\u{E0000}/gu;

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

/** True when the arg is a 1-based task position ("!done 2", "!remove 1", …). */
function isPositionArg(arg: string | undefined): arg is string {
  return arg != null && /^\d+$/.test(arg);
}

/**
 * Hardcoded bad-usage reply for !remove/!focus (like the !dwhelp fallback) —
 * reusing config.task.noTask here would falsely tell a viewer with open tasks
 * that they aren't tracking anything.
 */
export function parseTaskEditArgs(args: string[]): { position: string; text: string } | null {
  if (args.length < 2 || !isPositionArg(args[0])) return null;
  const text = truncateToLength(args.slice(1).join(" ").trim(), MAX_TASK_LEN);
  return text ? { position: args[0], text } : null;
}

const POSITIONAL_USAGE_REPLY = (displayName: string) =>
  `Give me a task number, ${displayName} — try !remove [number] (or !focus [number]). Check your numbers with !check!`;

/** Hardcoded like POSITIONAL_USAGE_REPLY: no owner template fits "retry". */
const STALE_NEXT_REPLY = (displayName: string) =>
  `Your current task changed before I could replace it, ${displayName} — check it with !check and try !next again.`;

/**
 * Resolve a 1-based position arg to the viewer's nth open task — the lookup
 * every positional task command (!done/!edit/!remove/!focus) repeats. Returns
 * null when the position is out of range.
 */
async function getTaskAtPosition(db: DbClient, twitchId: string, arg: string) {
  const viewerTasks = await getViewerOpenTasks(db, twitchId);
  return viewerTasks[parseInt(arg, 10) - 1] ?? null;
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
  "!next",
  "!help",
  "!clear",
]);

export async function handleMessage(ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, channelName } = ctx;
  const claim = async () => (ctx.claim ? ctx.claim() : true);
  const message = ctx.message.replace(DUPLICATE_BYPASS_SUFFIX, "").trim();

  if (!message.startsWith("!")) return;

  const parts = message.split(/\s+/);
  if (!parts[0]) return;
  let command = parts[0].toLowerCase();
  const args = parts.slice(1);

  command = resolveAlias(command, config.commandAliases);

  const vars = {
    user: userInfo.displayName,
    channel: channelName,
  };

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
    if (ctx.docsUrl) {
      say(
        `${userInfo.displayName}, check out all the commands here: ${ctx.docsUrl}/docs/chat-commands`,
      );
    } else {
      say(
        `${userInfo.displayName}, available commands: !task, !done, !edit, !remove, !focus, !check, !next, !help, !clear (mods), !timer (mods)`,
      );
    }
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

  await createTask(db, userInfo, text);
  say(interpolate(config.task.taskAdded, vars));
}

async function handleTaskDone(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  const task = isPositionArg(args[0])
    ? await getTaskAtPosition(db, userInfo.twitchId, args[0])
    : await getActiveTask(db, userInfo.twitchId);

  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await markTaskDone(db, task.id);
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

  if (!isPositionArg(args[0])) {
    // Bad usage, not "no tasks" — config.task.noTask would falsely tell a
    // viewer with open tasks that they aren't tracking anything.
    say(POSITIONAL_USAGE_REPLY(userInfo.displayName));
    return;
  }

  const task = await getTaskAtPosition(db, userInfo.twitchId, args[0]);
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

  if (!isPositionArg(args[0])) {
    // Bad usage, not "no tasks" — same rationale as handleTaskRemove.
    say(POSITIONAL_USAGE_REPLY(userInfo.displayName));
    return;
  }

  const task = await getTaskAtPosition(db, userInfo.twitchId, args[0]);
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

  if (args[0]?.startsWith("@")) {
    const targetTask = await findActiveTaskByUsername(db, args[0].slice(1));

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

  const [openTasks, activeTask] = await Promise.all([
    getViewerOpenTasks(db, userInfo.twitchId),
    getActiveTask(db, userInfo.twitchId),
  ]);

  // L1: cap counts against the state AFTER the active task completes.
  if (openTasks.length - (activeTask ? 1 : 0) >= CHAT_OPEN_TASK_CAP) {
    say(interpolate(config.task.noTaskAdded, vars));
    return;
  }

  // No active task means there is no {oldTask} to announce — fall back to the
  // plain taskAdded template instead of interpolating empty quotes.
  if (!activeTask) {
    await createTask(db, userInfo, newText, { activate: true });
    say(interpolate(config.task.taskAdded, { ...vars, task: newText }));
    return;
  }

  const result = await replaceActiveTask(db, activeTask, userInfo, newText);
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
    await removeTasksByUsername(db, sub.slice(1));
    say(interpolate(config.task.adminDeleteTasks, vars));
  }
}

async function handleTimerCommand(args: string[], ctx: MessageContext): Promise<void> {
  const { config, say, db, channelName, userInfo } = ctx;
  const sub = args[0]?.toLowerCase();
  const vars = { user: userInfo.displayName, channel: channelName };

  switch (sub) {
    case "start": {
      const timer = await getTimerState(db);
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
      const result = await pauseTimer(db);
      say(interpolate(result ? config.timer.commandSuccess : config.timer.notRunning, vars));
      break;
    }

    case "resume": {
      const result = await resumeTimer(db);
      say(interpolate(result ? config.timer.commandSuccess : config.timer.notRunning, vars));
      break;
    }

    case "skip": {
      const result = await skipTimer(db);
      say(interpolate(result ? config.timer.commandSuccess : config.timer.notRunning, vars));
      break;
    }

    case "reset": {
      await resetTimer(db);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "eta": {
      const eta = await getTimerEta(db);
      if (!eta) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      // Relative durations, not wall-clock times — the Worker has no idea
      // what timezone the channel is in (Date#toLocaleTimeString is UTC here).
      const now = Date.now();
      say(
        interpolate(config.timer.eta, {
          ...vars,
          phase: formatEtaDuration(eta.phaseEnd.getTime() - now),
          time: formatEtaDuration(eta.sessionEnd.getTime() - now),
        }),
      );
      break;
    }

    default:
      say(interpolate(config.timer.wrongCommand, vars));
  }
}
