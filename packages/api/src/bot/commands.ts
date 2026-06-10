import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { emitEvent, TASK_LIST_CHANGE, TIMER_STATE_CHANGE } from "../events";
import { getTimerConfig, computeNextPhase } from "../routers/timer-logic";

export interface BotConfigData {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  commandAliases: Record<string, string>;
  task: {
    taskAdded: string;
    noTaskAdded: string;
    noTaskContent: string;
    noTaskToEdit: string;
    taskEdited: string;
    taskRemoved: string;
    taskNext: string;
    adminDeleteTasks: string;
    taskDone: string;
    taskCheck: string;
    taskCheckUser: string;
    noTask: string;
    noTaskOther: string;
    notMod: string;
    clearedAll: string;
    clearedDone: string;
    nextNoContent: string;
    help: string;
  };
  timer: {
    workMsg: string;
    breakMsg: string;
    longBreakMsg: string;
    workRemindMsg: string;
    notRunning: string;
    streamStarting: string;
    wrongCommand: string;
    timerRunning: string;
    commandSuccess: string;
    cycleWrong: string;
    goalWrong: string;
    finishResponse: string;
    alreadyStarting: string;
    eta: string;
  };
}

interface UserInfo {
  twitchId: string;
  username: string;
  displayName: string;
  color: string | null;
  isBroadcaster: boolean;
  isMod: boolean;
}

interface MessageContext {
  db: DbClient;
  channelName: string;
  config: BotConfigData;
  message: string;
  userInfo: UserInfo;
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
    const docsUrl = env.DOCS_URL;
    if (docsUrl) {
      say(`${userInfo.displayName}, check out all the commands here: ${docsUrl}/docs/chat-commands`);
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
  const text = args.join(" ").trim();
  const vars = { user: userInfo.displayName, channel: ctx.channelName, task: text };

  if (!text) {
    say(interpolate(config.task.noTaskContent, vars));
    return;
  }

  const existingTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      inArray(schema.task.status, ["pending", "active"]),
    ),
    columns: { id: true },
  });

  const owner = await db.query.user.findFirst({ columns: { twitchId: true } });
  const isBroadcaster = owner?.twitchId === userInfo.twitchId;

  const lastTask = await db.query.task.findFirst({
    where: eq(schema.task.priority, isBroadcaster ? 0 : 1),
    orderBy: [desc(schema.task.order)],
    columns: { order: true },
  });

  const autoActivate = existingTasks.length === 0;

  await db.insert(schema.task).values({
    authorTwitchId: userInfo.twitchId,
    authorUsername: userInfo.username,
    authorDisplayName: userInfo.displayName,
    authorColor: userInfo.color,
    text,
    status: autoActivate ? "active" : "pending",
    priority: isBroadcaster ? 0 : 1,
    order: (lastTask?.order ?? 0) + 1,
  });

  emitEvent(TASK_LIST_CHANGE);
  say(interpolate(config.task.taskAdded, vars));
}

async function handleTaskDone(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  let task;

  if (args[0] && /^\d+$/.test(args[0])) {
    const position = parseInt(args[0], 10);
    const viewerTasks = await db.query.task.findMany({
      where: and(
        eq(schema.task.authorTwitchId, userInfo.twitchId),
        inArray(schema.task.status, ["pending", "active"]),
      ),
      orderBy: [asc(schema.task.order)],
    });
    task = viewerTasks[position - 1];
  } else {
    task = await db.query.task.findFirst({
      where: and(
        eq(schema.task.authorTwitchId, userInfo.twitchId),
        eq(schema.task.status, "active"),
      ),
    });
  }

  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await db.update(schema.task)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(schema.task.id, task.id));

  const nextPending = await db.query.task.findFirst({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      eq(schema.task.status, "pending"),
    ),
    orderBy: [asc(schema.task.order)],
  });
  if (nextPending) {
    await db.update(schema.task)
      .set({ status: "active" })
      .where(eq(schema.task.id, nextPending.id));
  }

  emitEvent(TASK_LIST_CHANGE);
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
  const newText = args.slice(1).join(" ").trim();

  const viewerTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      inArray(schema.task.status, ["pending", "active"]),
    ),
    orderBy: [asc(schema.task.order)],
  });

  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  await db.update(schema.task)
    .set({ text: newText })
    .where(eq(schema.task.id, task.id));

  emitEvent(TASK_LIST_CHANGE);
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
  const viewerTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      inArray(schema.task.status, ["pending", "active"]),
    ),
    orderBy: [asc(schema.task.order)],
  });

  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await db.delete(schema.task).where(eq(schema.task.id, task.id));

  if (task.status === "active") {
    const nextPending = await db.query.task.findFirst({
      where: and(
        eq(schema.task.authorTwitchId, userInfo.twitchId),
        eq(schema.task.status, "pending"),
      ),
      orderBy: [asc(schema.task.order)],
    });
    if (nextPending) {
      await db.update(schema.task)
        .set({ status: "active" })
        .where(eq(schema.task.id, nextPending.id));
    }
  }

  emitEvent(TASK_LIST_CHANGE);
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
  const viewerTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      inArray(schema.task.status, ["pending", "active"]),
    ),
    orderBy: [asc(schema.task.order)],
  });

  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await db.update(schema.task)
    .set({ status: "pending" })
    .where(and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      eq(schema.task.status, "active"),
    ));

  await db.update(schema.task)
    .set({ status: "active" })
    .where(eq(schema.task.id, task.id));

  emitEvent(TASK_LIST_CHANGE);
  say(interpolate(config.task.taskCheck, { ...vars, task: task.text }));
}

async function handleTaskCheck(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (args[0] && args[0].startsWith("@")) {
    const targetUsername = args[0].slice(1);
    const targetTask = await db.query.task.findFirst({
      where: and(
        sql`lower(${schema.task.authorUsername}) = lower(${targetUsername})`,
        eq(schema.task.status, "active"),
      ),
    });

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

  const activeTask = await db.query.task.findFirst({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      eq(schema.task.status, "active"),
    ),
  });

  if (!activeTask) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  say(interpolate(config.task.taskCheck, { ...vars, task: activeTask.text }));
}

async function handleTaskNext(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db } = ctx;
  const newText = args.join(" ").trim();
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!newText) {
    say(interpolate(config.task.nextNoContent, vars));
    return;
  }

  const activeTask = await db.query.task.findFirst({
    where: and(
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      eq(schema.task.status, "active"),
    ),
  });

  if (activeTask) {
    await db.update(schema.task)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(schema.task.id, activeTask.id));
  }

  const owner = await db.query.user.findFirst({ columns: { twitchId: true } });
  const isBroadcaster = owner?.twitchId === userInfo.twitchId;

  const lastTask = await db.query.task.findFirst({
    where: eq(schema.task.priority, isBroadcaster ? 0 : 1),
    orderBy: [desc(schema.task.order)],
    columns: { order: true },
  });

  await db.insert(schema.task).values({
    authorTwitchId: userInfo.twitchId,
    authorUsername: userInfo.username,
    authorDisplayName: userInfo.displayName,
    authorColor: userInfo.color,
    text: newText,
    status: "active",
    priority: isBroadcaster ? 0 : 1,
    order: (lastTask?.order ?? 0) + 1,
  });

  emitEvent(TASK_LIST_CHANGE);
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
    await db.delete(schema.task);
    emitEvent(TASK_LIST_CHANGE);
    say(interpolate(config.task.clearedAll, vars));
  } else if (sub === "done") {
    await db.delete(schema.task).where(eq(schema.task.status, "done"));
    emitEvent(TASK_LIST_CHANGE);
    say(interpolate(config.task.clearedDone, vars));
  } else if (sub && sub.startsWith("@")) {
    const targetUsername = sub.slice(1);
    await db.delete(schema.task)
      .where(sql`lower(${schema.task.authorUsername}) = lower(${targetUsername})`);
    emitEvent(TASK_LIST_CHANGE);
    say(interpolate(config.task.adminDeleteTasks, vars));
  }
}

async function handleTimerCommand(args: string[], ctx: MessageContext): Promise<void> {
  const { config, say, db, channelName, userInfo } = ctx;
  const sub = args[0]?.toLowerCase();
  const vars = { user: userInfo.displayName, channel: channelName };

  switch (sub) {
    case "start": {
      const timer = await db.query.timerState.findFirst();
      if (timer && timer.status !== "idle" && timer.status !== "finished") {
        say(interpolate(config.timer.timerRunning, vars));
        return;
      }

      const timerConfigRow = await db.query.timerConfig.findFirst();
      const tc = getTimerConfig(timerConfigRow ?? null);
      const totalCycles = args[1] ? parseInt(args[1], 10) : timerConfigRow?.defaultCycles ?? 4;

      await db.insert(schema.timerState)
        .values({
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles,
        })
        .onConflictDoUpdate({
          target: schema.timerState.id,
          set: {
            status: "starting",
            targetEndTime: new Date(Date.now() + tc.startingDuration),
            pausedWithRemaining: null,
            pausedFromStatus: null,
            currentCycle: 1,
            totalCycles,
          },
        });

      emitEvent(TIMER_STATE_CHANGE);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "pause": {
      const timer = await db.query.timerState.findFirst();
      if (!timer?.targetEndTime) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());
      await db.update(schema.timerState)
        .set({
          status: "paused",
          pausedFromStatus: timer.status,
          pausedWithRemaining: remaining,
          targetEndTime: null,
        });

      emitEvent(TIMER_STATE_CHANGE);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "resume": {
      const timer = await db.query.timerState.findFirst();
      if (!timer?.pausedWithRemaining) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const resumeStatus = timer.pausedFromStatus ?? "work";
      await db.update(schema.timerState)
        .set({
          status: resumeStatus,
          targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
          pausedWithRemaining: null,
          pausedFromStatus: null,
        });

      emitEvent(TIMER_STATE_CHANGE);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "skip": {
      const [timer, timerConfigRow] = await Promise.all([
        db.query.timerState.findFirst(),
        db.query.timerConfig.findFirst(),
      ]);
      if (!timer) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const effectiveStatus = timer.status === "paused"
        ? (timer.pausedFromStatus ?? "work")
        : timer.status;

      const tc = getTimerConfig(timerConfigRow ?? null);
      const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
        { status: effectiveStatus, currentCycle: timer.currentCycle, totalCycles: timer.totalCycles },
        tc,
      );

      const data: Record<string, unknown> = {
        status: nextStatus,
        currentCycle: nextCycle,
        pausedFromStatus: null,
        pausedWithRemaining: null,
      };

      if (nextDuration) {
        data.targetEndTime = new Date(Date.now() + nextDuration);
      } else {
        data.targetEndTime = null;
      }

      await db.update(schema.timerState).set(data);
      emitEvent(TIMER_STATE_CHANGE);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "reset": {
      await db.update(schema.timerState)
        .set({
          status: "idle",
          targetEndTime: null,
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles: 4,
        });
      emitEvent(TIMER_STATE_CHANGE);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "eta": {
      const timer = await db.query.timerState.findFirst();
      if (!timer?.targetEndTime) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const timerConfigRow = await db.query.timerConfig.findFirst();
      const tc = getTimerConfig(timerConfigRow ?? null);

      let totalMs = timer.targetEndTime.getTime() - Date.now();
      let cycle = timer.currentCycle;
      let status = timer.status;

      while (status !== "finished" && cycle <= timer.totalCycles) {
        const { nextStatus, nextDuration, nextCycle } = computeNextPhase(
          { status, currentCycle: cycle, totalCycles: timer.totalCycles },
          tc,
        );
        if (nextDuration) totalMs += nextDuration;
        if (nextStatus === status && nextDuration === null) break;
        status = nextStatus;
        cycle = nextCycle;
      }

      const etaDate = new Date(Date.now() + totalMs);
      const timeStr = etaDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      say(interpolate(config.timer.eta, { ...vars, time: timeStr }));
      break;
    }

    default:
      say(interpolate(config.timer.wrongCommand, vars));
  }
}
