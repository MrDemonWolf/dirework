import type { DbClient } from "@dirework/db";

import type { BotConfigData } from "../config-shared";
import { CHAT_OPEN_TASK_CAP, MAX_TASK_LEN } from "../config-shared";
import {
  activateTask,
  clearAllTasks,
  clearDoneTasks,
  completeTask,
  createTask,
  editTask,
  findActiveTaskByUsername,
  getActiveTask,
  getViewerOpenTasks,
  markTaskDone,
  removeTask,
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
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function resolveAlias(command: string, aliases: Record<string, string>): string {
  for (const [alias, target] of Object.entries(aliases)) {
    if (command === `!${alias}`.toLowerCase()) {
      return `!${target}`.toLowerCase();
    }
  }
  return command;
}

export async function handleMessage(ctx: MessageContext): Promise<void> {
  const { config, message, userInfo, say, channelName } = ctx;

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
    if (!userInfo.isMod) {
      say(interpolate(config.task.notMod, vars));
      return;
    }
    await handleTimerCommand(args, ctx);
    return;
  }

  if (command === "!dwhelp" || command === "!dwcommands") {
    if (ctx.docsUrl) {
      say(`${userInfo.displayName}, check out all the commands here: ${ctx.docsUrl}/docs/chat-commands`);
    } else {
      say(`${userInfo.displayName}, available commands: !task, !done, !edit, !remove, !focus, !check, !next, !help, !clear (mods), !timer (mods)`);
    }
    return;
  }

  if (!config.taskCommandsEnabled) return;

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
  const text = args.join(" ").trim().slice(0, MAX_TASK_LEN);
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

  let task;

  if (args[0] && /^\d+$/.test(args[0])) {
    const position = parseInt(args[0], 10);
    const viewerTasks = await getViewerOpenTasks(db, userInfo.twitchId);
    task = viewerTasks[position - 1];
  } else {
    task = await getActiveTask(db, userInfo.twitchId);
  }

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

  const firstArg = args[0];
  if (args.length < 2 || !firstArg || !/^\d+$/.test(firstArg)) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  const position = parseInt(firstArg, 10);
  const newText = args.slice(1).join(" ").trim().slice(0, MAX_TASK_LEN);

  const viewerTasks = await getViewerOpenTasks(db, userInfo.twitchId);
  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  await editTask(db, task.id, newText);
  say(interpolate(config.task.taskEdited, { ...vars, task: newText }));
}

async function handleTaskRemove(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!args[0] || !/^\d+$/.test(args[0])) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  const position = parseInt(args[0], 10);
  const viewerTasks = await getViewerOpenTasks(db, userInfo.twitchId);
  const task = viewerTasks[position - 1];
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

  if (!args[0] || !/^\d+$/.test(args[0])) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  const position = parseInt(args[0], 10);
  const viewerTasks = await getViewerOpenTasks(db, userInfo.twitchId);
  const task = viewerTasks[position - 1];
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

  if (args[0] && args[0].startsWith("@")) {
    const targetTask = await findActiveTaskByUsername(db, args[0].slice(1));

    if (!targetTask) {
      say(interpolate(config.task.noTaskOther, vars));
      return;
    }

    say(interpolate(config.task.taskCheckUser, {
      ...vars,
      user2: targetTask.authorDisplayName,
      task: targetTask.text,
    }));
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
  const newText = args.join(" ").trim().slice(0, MAX_TASK_LEN);
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

  if (activeTask) {
    // No promotion here — the new task becomes the active one.
    await completeTask(db, activeTask.id);
  }

  await createTask(db, userInfo, newText, { activate: true });
  say(interpolate(config.task.taskNext, {
    ...vars,
    oldTask: activeTask?.text ?? "",
    newTask: newText,
  }));
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
  } else if (sub && sub.startsWith("@")) {
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
      const etaDate = await getTimerEta(db);
      if (!etaDate) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const timeStr = etaDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      say(interpolate(config.timer.eta, { ...vars, time: timeStr }));
      break;
    }

    default:
      say(interpolate(config.timer.wrongCommand, vars));
  }
}
