import { eq, and, asc, inArray, sql } from "drizzle-orm";
import type { DbClient } from "@dirework/db";
import * as schema from "@dirework/db/schema";
import { env } from "@dirework/env/server";

import { ee } from "../events";
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
  ownerId: string;
  channelName: string;
  config: BotConfigData;
  message: string;
  userInfo: UserInfo;
  say: (text: string) => void;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export async function handleMessage(ctx: MessageContext): Promise<void> {
  const { config, message, userInfo, say, channelName } = ctx;

  if (!message.startsWith("!")) return;

  const parts = message.split(/\s+/);
  if (!parts[0]) return;
  let command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Resolve aliases
  for (const [alias, target] of Object.entries(config.commandAliases)) {
    if (command === `!${alias}`.toLowerCase()) {
      command = `!${target}`.toLowerCase();
      break;
    }
  }

  const vars = {
    user: userInfo.displayName,
    channel: channelName,
  };

  // Timer commands
  if (command === "!timer") {
    if (!config.timerCommandsEnabled) return;
    if (!userInfo.isMod) {
      say(interpolate(config.task.notMod, vars));
      return;
    }
    await handleTimerCommand(args, ctx);
    return;
  }

  // Meta commands (always available, not aliasable)
  if (command === "!dwhelp" || command === "!dwcommands") {
    const docsUrl = env.DOCS_URL;
    if (docsUrl) {
      say(`${userInfo.displayName}, check out all the commands here: ${docsUrl}/docs/chat-commands`);
    } else {
      say(`${userInfo.displayName}, available commands: !task, !done, !edit, !remove, !focus, !check, !next, !help, !clear (mods), !timer (mods)`);
    }
    return;
  }

  // Task commands
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
  const { config, userInfo, say, db, ownerId } = ctx;
  const text = args.join(" ").trim();
  const vars = { user: userInfo.displayName, channel: ctx.channelName, task: text };

  if (!text) {
    say(interpolate(config.task.noTaskContent, vars));
    return;
  }

  // Check for existing pending/active tasks
  const existingTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.ownerId, ownerId),
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      inArray(schema.task.status, ["pending", "active"]),
    ),
    columns: { id: true },
  });

  // Determine broadcaster priority
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, ownerId),
    columns: { twitchId: true },
  });
  const isBroadcaster = user?.twitchId === userInfo.twitchId;

  const lastTask = await db.query.task.findFirst({
    where: and(eq(schema.task.ownerId, ownerId), eq(schema.task.priority, isBroadcaster ? 0 : 1)),
    orderBy: [asc(schema.task.order)],
    columns: { order: true },
  });

  const autoActivate = existingTasks.length === 0;

  await db.insert(schema.task).values({
    ownerId,
    authorTwitchId: userInfo.twitchId,
    authorUsername: userInfo.username,
    authorDisplayName: userInfo.displayName,
    authorColor: userInfo.color,
    text,
    status: autoActivate ? "active" : "pending",
    priority: isBroadcaster ? 0 : 1,
    order: (lastTask?.order ?? 0) + 1,
  });

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskAdded, vars));
}

async function handleTaskDone(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  let task;

  if (args[0] && /^\d+$/.test(args[0])) {
    // Position-based
    const position = parseInt(args[0], 10);
    const viewerTasks = await db.query.task.findMany({
      where: and(
        eq(schema.task.ownerId, ownerId),
        eq(schema.task.authorTwitchId, userInfo.twitchId),
        inArray(schema.task.status, ["pending", "active"]),
      ),
      orderBy: [asc(schema.task.order)],
    });
    task = viewerTasks[position - 1];
  } else {
    // Active task
    task = await db.query.task.findFirst({
      where: and(
        eq(schema.task.ownerId, ownerId),
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

  // Auto-activate next pending task
  const nextPending = await db.query.task.findFirst({
    where: and(
      eq(schema.task.ownerId, ownerId),
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

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskDone, { ...vars, task: task.text }));
}

async function handleTaskEdit(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db, ownerId } = ctx;
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
      eq(schema.task.ownerId, ownerId),
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

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskEdited, { ...vars, task: newText }));
}

async function handleTaskRemove(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!args[0] || !/^\d+$/.test(args[0])) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  const position = parseInt(args[0], 10);
  const viewerTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.ownerId, ownerId),
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

  // If we removed an active task, auto-activate next pending
  if (task.status === "active") {
    const nextPending = await db.query.task.findFirst({
      where: and(
        eq(schema.task.ownerId, ownerId),
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

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskRemoved, { ...vars, task: task.text }));
}

async function handleTaskFocus(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!args[0] || !/^\d+$/.test(args[0])) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  const position = parseInt(args[0], 10);
  const viewerTasks = await db.query.task.findMany({
    where: and(
      eq(schema.task.ownerId, ownerId),
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

  // Deactivate any current active task
  await db.update(schema.task)
    .set({ status: "pending" })
    .where(and(
      eq(schema.task.ownerId, ownerId),
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      eq(schema.task.status, "active"),
    ));

  // Activate the target task
  await db.update(schema.task)
    .set({ status: "active" })
    .where(eq(schema.task.id, task.id));

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskCheck, { ...vars, task: task.text }));
}

async function handleTaskCheck(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (args[0] && args[0].startsWith("@")) {
    // Check another user
    const targetUsername = args[0].slice(1);
    const targetTask = await db.query.task.findFirst({
      where: and(
        eq(schema.task.ownerId, ownerId),
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

  // Check own tasks
  const activeTask = await db.query.task.findFirst({
    where: and(
      eq(schema.task.ownerId, ownerId),
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
  const { config, userInfo, say, db, ownerId } = ctx;
  const newText = args.join(" ").trim();
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!newText) {
    say(interpolate(config.task.nextNoContent, vars));
    return;
  }

  // Mark active task as done
  const activeTask = await db.query.task.findFirst({
    where: and(
      eq(schema.task.ownerId, ownerId),
      eq(schema.task.authorTwitchId, userInfo.twitchId),
      eq(schema.task.status, "active"),
    ),
  });

  if (activeTask) {
    await db.update(schema.task)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(schema.task.id, activeTask.id));
  }

  // Determine broadcaster priority
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, ownerId),
    columns: { twitchId: true },
  });
  const isBroadcaster = user?.twitchId === userInfo.twitchId;

  const lastTask = await db.query.task.findFirst({
    where: and(eq(schema.task.ownerId, ownerId), eq(schema.task.priority, isBroadcaster ? 0 : 1)),
    orderBy: [asc(schema.task.order)],
    columns: { order: true },
  });

  // Create new task as active
  await db.insert(schema.task).values({
    ownerId,
    authorTwitchId: userInfo.twitchId,
    authorUsername: userInfo.username,
    authorDisplayName: userInfo.displayName,
    authorColor: userInfo.color,
    text: newText,
    status: "active",
    priority: isBroadcaster ? 0 : 1,
    order: (lastTask?.order ?? 0) + 1,
  });

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskNext, {
    ...vars,
    oldTask: activeTask?.text ?? "",
    newTask: newText,
  }));
}

async function handleClear(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, db, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!userInfo.isMod) {
    say(interpolate(config.task.notMod, vars));
    return;
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "all") {
    await db.delete(schema.task).where(eq(schema.task.ownerId, ownerId));
    ee.emit(`taskListChange:${ownerId}`);
    say(interpolate(config.task.clearedAll, vars));
  } else if (sub === "done") {
    await db.delete(schema.task).where(and(eq(schema.task.ownerId, ownerId), eq(schema.task.status, "done")));
    ee.emit(`taskListChange:${ownerId}`);
    say(interpolate(config.task.clearedDone, vars));
  } else if (sub && sub.startsWith("@")) {
    const targetUsername = sub.slice(1);
    await db.delete(schema.task)
      .where(and(
        eq(schema.task.ownerId, ownerId),
        sql`lower(${schema.task.authorUsername}) = lower(${targetUsername})`,
      ));
    ee.emit(`taskListChange:${ownerId}`);
    say(interpolate(config.task.adminDeleteTasks, vars));
  }
}

async function handleTimerCommand(args: string[], ctx: MessageContext): Promise<void> {
  const { config, say, db, ownerId, channelName, userInfo } = ctx;
  const sub = args[0]?.toLowerCase();
  const vars = { user: userInfo.displayName, channel: channelName };

  switch (sub) {
    case "start": {
      const timer = await db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ownerId) });
      if (timer && timer.status !== "idle" && timer.status !== "finished") {
        say(interpolate(config.timer.timerRunning, vars));
        return;
      }

      const timerConfigRow = await db.query.timerConfig.findFirst({ where: eq(schema.timerConfig.userId, ownerId) });
      const tc = getTimerConfig(timerConfigRow ?? null);
      const totalCycles = args[1] ? parseInt(args[1], 10) : timerConfigRow?.defaultCycles ?? 4;

      await db.insert(schema.timerState)
        .values({
          userId: ownerId,
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles,
        })
        .onConflictDoUpdate({
          target: schema.timerState.userId,
          set: {
            status: "starting",
            targetEndTime: new Date(Date.now() + tc.startingDuration),
            pausedWithRemaining: null,
            pausedFromStatus: null,
            currentCycle: 1,
            totalCycles,
          },
        });

      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "pause": {
      const timer = await db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ownerId) });
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
        })
        .where(eq(schema.timerState.userId, ownerId));

      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "resume": {
      const timer = await db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ownerId) });
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
        })
        .where(eq(schema.timerState.userId, ownerId));

      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "skip": {
      const [timer, timerConfigRow] = await Promise.all([
        db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ownerId) }),
        db.query.timerConfig.findFirst({ where: eq(schema.timerConfig.userId, ownerId) }),
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

      await db.update(schema.timerState)
        .set(data)
        .where(eq(schema.timerState.userId, ownerId));
      ee.emit(`timerStateChange:${ownerId}`);
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
        })
        .where(eq(schema.timerState.userId, ownerId));
      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "eta": {
      const timer = await db.query.timerState.findFirst({ where: eq(schema.timerState.userId, ownerId) });
      if (!timer?.targetEndTime) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const timerConfigRow = await db.query.timerConfig.findFirst({ where: eq(schema.timerConfig.userId, ownerId) });
      const tc = getTimerConfig(timerConfigRow ?? null);

      // Calculate estimated end time based on remaining cycles
      let totalMs = timer.targetEndTime.getTime() - Date.now();
      let cycle = timer.currentCycle;
      let status = timer.status;

      // Add remaining phases
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
      const timeStr = etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      say(interpolate(config.timer.eta, { ...vars, time: timeStr }));
      break;
    }

    default:
      say(interpolate(config.timer.wrongCommand, vars));
  }
}
