import type prismaDefault from "@dirework/db";

import { ee } from "../events";

type PrismaClient = typeof prismaDefault;
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
  prisma: PrismaClient;
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
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const text = args.join(" ").trim();
  const vars = { user: userInfo.displayName, channel: ctx.channelName, task: text };

  if (!text) {
    say(interpolate(config.task.noTaskContent, vars));
    return;
  }

  // Check for existing pending/active tasks
  const existingTasks = await prisma.task.findMany({
    where: {
      ownerId,
      authorTwitchId: userInfo.twitchId,
      status: { in: ["pending", "active"] },
    },
    select: { id: true },
  });

  // Determine broadcaster priority
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { twitchId: true },
  });
  const isBroadcaster = user?.twitchId === userInfo.twitchId;

  const lastTask = await prisma.task.findFirst({
    where: { ownerId, priority: isBroadcaster ? 0 : 1 },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const autoActivate = existingTasks.length === 0;

  await prisma.task.create({
    data: {
      ownerId,
      authorTwitchId: userInfo.twitchId,
      authorUsername: userInfo.username,
      authorDisplayName: userInfo.displayName,
      authorColor: userInfo.color,
      text,
      status: autoActivate ? "active" : "pending",
      priority: isBroadcaster ? 0 : 1,
      order: (lastTask?.order ?? 0) + 1,
    },
  });

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskAdded, vars));
}

async function handleTaskDone(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  let task;

  if (args[0] && /^\d+$/.test(args[0])) {
    // Position-based
    const position = parseInt(args[0], 10);
    const viewerTasks = await prisma.task.findMany({
      where: { ownerId, authorTwitchId: userInfo.twitchId, status: { in: ["pending", "active"] } },
      orderBy: { order: "asc" },
    });
    task = viewerTasks[position - 1];
  } else {
    // Active task
    task = await prisma.task.findFirst({
      where: { ownerId, authorTwitchId: userInfo.twitchId, status: "active" },
    });
  }

  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: "done", completedAt: new Date() },
  });

  // Auto-activate next pending task
  const nextPending = await prisma.task.findFirst({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: "pending" },
    orderBy: { order: "asc" },
  });
  if (nextPending) {
    await prisma.task.update({
      where: { id: nextPending.id },
      data: { status: "active" },
    });
  }

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskDone, { ...vars, task: task.text }));
}

async function handleTaskEdit(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  const firstArg = args[0];
  if (args.length < 2 || !firstArg || !/^\d+$/.test(firstArg)) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  const position = parseInt(firstArg, 10);
  const newText = args.slice(1).join(" ").trim();

  const viewerTasks = await prisma.task.findMany({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: { in: ["pending", "active"] } },
    orderBy: { order: "asc" },
  });

  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTaskToEdit, vars));
    return;
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { text: newText },
  });

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskEdited, { ...vars, task: newText }));
}

async function handleTaskRemove(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!args[0] || !/^\d+$/.test(args[0])) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  const position = parseInt(args[0], 10);
  const viewerTasks = await prisma.task.findMany({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: { in: ["pending", "active"] } },
    orderBy: { order: "asc" },
  });

  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  await prisma.task.delete({ where: { id: task.id } });

  // If we removed an active task, auto-activate next pending
  if (task.status === "active") {
    const nextPending = await prisma.task.findFirst({
      where: { ownerId, authorTwitchId: userInfo.twitchId, status: "pending" },
      orderBy: { order: "asc" },
    });
    if (nextPending) {
      await prisma.task.update({
        where: { id: nextPending.id },
        data: { status: "active" },
      });
    }
  }

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskRemoved, { ...vars, task: task.text }));
}

async function handleTaskFocus(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!args[0] || !/^\d+$/.test(args[0])) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  const position = parseInt(args[0], 10);
  const viewerTasks = await prisma.task.findMany({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: { in: ["pending", "active"] } },
    orderBy: { order: "asc" },
  });

  const task = viewerTasks[position - 1];
  if (!task) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  // Deactivate any current active task
  await prisma.task.updateMany({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: "active" },
    data: { status: "pending" },
  });

  // Activate the target task
  await prisma.task.update({
    where: { id: task.id },
    data: { status: "active" },
  });

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskCheck, { ...vars, task: task.text }));
}

async function handleTaskCheck(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (args[0] && args[0].startsWith("@")) {
    // Check another user
    const targetUsername = args[0].slice(1).toLowerCase();
    const targetTask = await prisma.task.findFirst({
      where: {
        ownerId,
        authorUsername: { equals: targetUsername, mode: "insensitive" },
        status: "active",
      },
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
  const activeTask = await prisma.task.findFirst({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: "active" },
  });

  if (!activeTask) {
    say(interpolate(config.task.noTask, vars));
    return;
  }

  say(interpolate(config.task.taskCheck, { ...vars, task: activeTask.text }));
}

async function handleTaskNext(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const newText = args.join(" ").trim();
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!newText) {
    say(interpolate(config.task.nextNoContent, vars));
    return;
  }

  // Mark active task as done
  const activeTask = await prisma.task.findFirst({
    where: { ownerId, authorTwitchId: userInfo.twitchId, status: "active" },
  });

  if (activeTask) {
    await prisma.task.update({
      where: { id: activeTask.id },
      data: { status: "done", completedAt: new Date() },
    });
  }

  // Determine broadcaster priority
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { twitchId: true },
  });
  const isBroadcaster = user?.twitchId === userInfo.twitchId;

  const lastTask = await prisma.task.findFirst({
    where: { ownerId, priority: isBroadcaster ? 0 : 1 },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  // Create new task as active
  await prisma.task.create({
    data: {
      ownerId,
      authorTwitchId: userInfo.twitchId,
      authorUsername: userInfo.username,
      authorDisplayName: userInfo.displayName,
      authorColor: userInfo.color,
      text: newText,
      status: "active",
      priority: isBroadcaster ? 0 : 1,
      order: (lastTask?.order ?? 0) + 1,
    },
  });

  ee.emit(`taskListChange:${ownerId}`);
  say(interpolate(config.task.taskNext, {
    ...vars,
    oldTask: activeTask?.text ?? "",
    newTask: newText,
  }));
}

async function handleClear(args: string[], ctx: MessageContext): Promise<void> {
  const { config, userInfo, say, prisma, ownerId } = ctx;
  const vars = { user: userInfo.displayName, channel: ctx.channelName };

  if (!userInfo.isMod) {
    say(interpolate(config.task.notMod, vars));
    return;
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "all") {
    await prisma.task.deleteMany({ where: { ownerId } });
    ee.emit(`taskListChange:${ownerId}`);
    say(interpolate(config.task.clearedAll, vars));
  } else if (sub === "done") {
    await prisma.task.deleteMany({ where: { ownerId, status: "done" } });
    ee.emit(`taskListChange:${ownerId}`);
    say(interpolate(config.task.clearedDone, vars));
  } else if (sub && sub.startsWith("@")) {
    const targetUsername = sub.slice(1);
    await prisma.task.deleteMany({
      where: {
        ownerId,
        authorUsername: { equals: targetUsername, mode: "insensitive" },
      },
    });
    ee.emit(`taskListChange:${ownerId}`);
    say(interpolate(config.task.adminDeleteTasks, vars));
  }
}

async function handleTimerCommand(args: string[], ctx: MessageContext): Promise<void> {
  const { config, say, prisma, ownerId, channelName, userInfo } = ctx;
  const sub = args[0]?.toLowerCase();
  const vars = { user: userInfo.displayName, channel: channelName };

  switch (sub) {
    case "start": {
      const timer = await prisma.timerState.findUnique({ where: { userId: ownerId } });
      if (timer && timer.status !== "idle" && timer.status !== "finished") {
        say(interpolate(config.timer.timerRunning, vars));
        return;
      }

      const timerConfig = await prisma.timerConfig.findUnique({ where: { userId: ownerId } });
      const tc = getTimerConfig(timerConfig);
      const totalCycles = args[1] ? parseInt(args[1], 10) : timerConfig?.defaultCycles ?? 4;

      await prisma.timerState.upsert({
        where: { userId: ownerId },
        update: {
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles,
        },
        create: {
          userId: ownerId,
          status: "starting",
          targetEndTime: new Date(Date.now() + tc.startingDuration),
          currentCycle: 1,
          totalCycles,
        },
      });

      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "pause": {
      const timer = await prisma.timerState.findUnique({ where: { userId: ownerId } });
      if (!timer?.targetEndTime) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const remaining = Math.max(0, timer.targetEndTime.getTime() - Date.now());
      await prisma.timerState.update({
        where: { userId: ownerId },
        data: {
          status: "paused",
          pausedFromStatus: timer.status,
          pausedWithRemaining: remaining,
          targetEndTime: null,
        },
      });

      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "resume": {
      const timer = await prisma.timerState.findUnique({ where: { userId: ownerId } });
      if (!timer?.pausedWithRemaining) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const resumeStatus = timer.pausedFromStatus ?? "work";
      await prisma.timerState.update({
        where: { userId: ownerId },
        data: {
          status: resumeStatus,
          targetEndTime: new Date(Date.now() + timer.pausedWithRemaining),
          pausedWithRemaining: null,
          pausedFromStatus: null,
        },
      });

      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "skip": {
      const [timer, timerConfig] = await Promise.all([
        prisma.timerState.findUnique({ where: { userId: ownerId } }),
        prisma.timerConfig.findUnique({ where: { userId: ownerId } }),
      ]);
      if (!timer) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const effectiveStatus = timer.status === "paused"
        ? (timer.pausedFromStatus ?? "work")
        : timer.status;

      const tc = getTimerConfig(timerConfig);
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

      await prisma.timerState.update({ where: { userId: ownerId }, data });
      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "reset": {
      await prisma.timerState.update({
        where: { userId: ownerId },
        data: {
          status: "idle",
          targetEndTime: null,
          pausedWithRemaining: null,
          pausedFromStatus: null,
          currentCycle: 1,
          totalCycles: 4,
        },
      });
      ee.emit(`timerStateChange:${ownerId}`);
      say(interpolate(config.timer.commandSuccess, vars));
      break;
    }

    case "eta": {
      const timer = await prisma.timerState.findUnique({ where: { userId: ownerId } });
      if (!timer?.targetEndTime) {
        say(interpolate(config.timer.notRunning, vars));
        return;
      }

      const timerConfig = await prisma.timerConfig.findUnique({ where: { userId: ownerId } });
      const tc = getTimerConfig(timerConfig);

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
