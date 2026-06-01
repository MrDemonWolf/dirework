"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Plus, RotateCcw, Save, SquareStop, Trash2, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import type {
  TaskMessagesConfig,
  TimerMessagesConfig,
  CommandAliasesConfig,
} from "@/lib/config-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskMessageEditor, TimerMessageEditor } from "@/components/bot-settings/message-editor";
import { trpc } from "@/utils/trpc";

const taskCommands = [
  { command: "!task", usage: "!task [task]", description: "Add a task" },
  { command: "!done", usage: "!done or !done [#]", description: "Mark task done" },
  { command: "!edit", usage: "!edit [#] [new task]", description: "Edit a task" },
  { command: "!remove", usage: "!remove [#]", description: "Remove a task" },
  { command: "!focus", usage: "!focus [#]", description: "Set active task" },
  { command: "!check", usage: "!check or !check @user", description: "Check current task" },
  { command: "!next", usage: "!next [task]", description: "Complete & add next task" },
  { command: "!help", usage: "!help", description: "Show help in chat" },
  { command: "!clear", usage: "!clear all/done/@user", description: "Clear tasks (mods only)" },
];

const timerCommands = [
  { command: "!timer start", usage: "!timer start [cycles]", description: "Start timer" },
  { command: "!timer pause", usage: "!timer pause", description: "Pause timer" },
  { command: "!timer resume", usage: "!timer resume", description: "Resume timer" },
  { command: "!timer skip", usage: "!timer skip", description: "Skip current phase" },
  { command: "!timer reset", usage: "!timer reset", description: "Reset to idle" },
  { command: "!timer eta", usage: "!timer eta", description: "Show end time ETA" },
];

const defaultTaskMessages: TaskMessagesConfig = {
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

const defaultTimerMessages: TimerMessagesConfig = {
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
  eta: "The hunt will end at {time}",
};

const defaultCommandAliases: CommandAliasesConfig = {};

function CommandTable({ commands }: { commands: { command: string; usage: string; description: string }[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-1 font-medium">Command</th>
          <th className="pb-1 font-medium">Usage</th>
          <th className="pb-1 font-medium">Description</th>
        </tr>
      </thead>
      <tbody>
        {commands.map((cmd) => (
          <tr key={cmd.command} className="border-b last:border-0">
            <td className="py-1.5 pr-3 font-mono font-medium">{cmd.command}</td>
            <td className="py-1.5 pr-3 font-mono text-muted-foreground">{cmd.usage}</td>
            <td className="py-1.5 text-muted-foreground">{cmd.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BotSettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="mb-4 h-9 w-72" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BotSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const config = useQuery(trpc.config.get.queryOptions());
  const user = useQuery(trpc.user.me.queryOptions());

  // Handle bot connection callback params
  useEffect(() => {
    const botStatus = searchParams.get("bot");
    if (botStatus === "connected") {
      toast.success("Bot account connected successfully!");
      router.replace("/dashboard/bot");
    } else if (botStatus === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      toast.error(`Failed to connect bot account: ${reason}`);
      router.replace("/dashboard/bot");
    }
  }, [searchParams, router]);

  // Working state
  const [taskCommandsEnabled, setTaskCommandsEnabled] = useState(true);
  const [timerCommandsEnabled, setTimerCommandsEnabled] = useState(true);
  const [taskMessages, setTaskMessages] = useState<TaskMessagesConfig>(defaultTaskMessages);
  const [timerMessages, setTimerMessages] = useState<TimerMessagesConfig>(defaultTimerMessages);
  const [commandAliases, setCommandAliases] = useState<CommandAliasesConfig>(defaultCommandAliases);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Saved state (for reset)
  const [savedTaskCommandsEnabled, setSavedTaskCommandsEnabled] = useState(true);
  const [savedTimerCommandsEnabled, setSavedTimerCommandsEnabled] = useState(true);
  const [savedTaskMessages, setSavedTaskMessages] = useState<TaskMessagesConfig>(defaultTaskMessages);
  const [savedTimerMessages, setSavedTimerMessages] = useState<TimerMessagesConfig>(defaultTimerMessages);
  const [savedCommandAliases, setSavedCommandAliases] = useState<CommandAliasesConfig>(defaultCommandAliases);

  // Once config loads, extract values
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!config.data) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const bot = config.data.botConfig;

    const tMsgs = bot?.task ?? defaultTaskMessages;
    const tmMsgs = bot?.timer ?? defaultTimerMessages;
    const aliases = (bot?.commandAliases ?? {}) as CommandAliasesConfig;

    setTaskCommandsEnabled(bot?.taskCommandsEnabled ?? true);
    setTimerCommandsEnabled(bot?.timerCommandsEnabled ?? true);
    setTaskMessages(tMsgs);
    setTimerMessages(tmMsgs);
    setCommandAliases(aliases);

    setSavedTaskCommandsEnabled(bot?.taskCommandsEnabled ?? true);
    setSavedTimerCommandsEnabled(bot?.timerCommandsEnabled ?? true);
    setSavedTaskMessages(tMsgs);
    setSavedTimerMessages(tmMsgs);
    setSavedCommandAliases(aliases);
  }, [config.data]);

  const botStatus = useQuery({
    ...trpc.bot.status.queryOptions(),
    refetchInterval: 5000,
  });

  const startBot = useMutation({
    ...trpc.bot.start.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.bot.status.queryKey() });
      toast.success("Bot started");
    },
    onError: (err) => {
      toast.error(`Failed to start bot: ${err.message}`);
    },
  });

  const stopBot = useMutation({
    ...trpc.bot.stop.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.bot.status.queryKey() });
      toast.success("Bot stopped");
    },
    onError: (err) => {
      toast.error(`Failed to stop bot: ${err.message}`);
    },
  });

  const disconnectBot = useMutation({
    ...trpc.user.disconnectBot.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.bot.status.queryKey() });
      toast.success("Bot account disconnected");
    },
  });

  const updateMessagesMutation = useMutation({
    ...trpc.config.updateMessages.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  const updateAliasesMutation = useMutation({
    ...trpc.config.updateCommandAliases.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  const isSaving =
    updateMessagesMutation.isPending ||
    updateAliasesMutation.isPending;

  const markUnsaved = useCallback(() => setHasUnsaved(true), []);

  const handleTaskMessagesChange = useCallback((newMessages: TaskMessagesConfig) => {
    setTaskMessages(newMessages);
    setHasUnsaved(true);
  }, []);

  const handleTimerMessagesChange = useCallback((newMessages: TimerMessagesConfig) => {
    setTimerMessages(newMessages);
    setHasUnsaved(true);
  }, []);

  const handleReset = useCallback(() => {
    setTaskCommandsEnabled(savedTaskCommandsEnabled);
    setTimerCommandsEnabled(savedTimerCommandsEnabled);
    setTaskMessages(savedTaskMessages);
    setTimerMessages(savedTimerMessages);
    setCommandAliases(savedCommandAliases);
    setHasUnsaved(false);
  }, [
    savedTaskCommandsEnabled,
    savedTimerCommandsEnabled,
    savedTaskMessages,
    savedTimerMessages,
    savedCommandAliases,
  ]);

  const handleSave = useCallback(async () => {
    try {
      await updateMessagesMutation.mutateAsync({
        taskCommandsEnabled,
        timerCommandsEnabled,
        task: taskMessages,
        timer: timerMessages,
      });
      await updateAliasesMutation.mutateAsync({
        commandAliases: commandAliases,
      });

      setSavedTaskCommandsEnabled(taskCommandsEnabled);
      setSavedTimerCommandsEnabled(timerCommandsEnabled);
      setSavedTaskMessages(taskMessages);
      setSavedTimerMessages(timerMessages);
      setSavedCommandAliases(commandAliases);
      setHasUnsaved(false);
      toast.success("Bot settings saved successfully");
    } catch {
      toast.error("Failed to save bot settings");
    }
  }, [
    taskCommandsEnabled,
    timerCommandsEnabled,
    taskMessages,
    timerMessages,
    commandAliases,
    updateMessagesMutation,
    updateAliasesMutation,
  ]);

  // Alias editor handlers
  const aliasEntries = Object.entries(commandAliases);

  const handleAddAlias = () => {
    setCommandAliases({ ...commandAliases, "": "" });
    markUnsaved();
  };

  const handleAliasKeyChange = (oldKey: string, newKey: string) => {
    const newAliases: CommandAliasesConfig = {};
    for (const [k, v] of Object.entries(commandAliases)) {
      if (k === oldKey) {
        newAliases[newKey] = v;
      } else {
        newAliases[k] = v;
      }
    }
    setCommandAliases(newAliases);
    markUnsaved();
  };

  const handleAliasValueChange = (key: string, value: string) => {
    setCommandAliases({ ...commandAliases, [key]: value });
    markUnsaved();
  };

  const handleAliasRemove = (key: string) => {
    const newAliases = { ...commandAliases };
    delete newAliases[key];
    setCommandAliases(newAliases);
    markUnsaved();
  };

  if (config.isLoading) {
    return <BotSettingsSkeleton />;
  }

  return (
    <div className={cn("container mx-auto max-w-5xl px-4 py-8", hasUnsaved && "pb-24")}>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Bot Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your bot account, response messages, and command aliases
        </p>
      </div>

      <div className="space-y-6">
        {/* Bot Account Card — full width */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Bot Account</CardTitle>
              {user.data?.botAccount && (
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  botStatus.data?.running
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-muted text-muted-foreground",
                )}>
                  <span className={cn(
                    "size-1.5 rounded-full",
                    botStatus.data?.running ? "bg-green-500" : "bg-muted-foreground/50",
                  )} />
                  {botStatus.data?.running ? "Online" : "Offline"}
                </span>
              )}
            </div>
            <CardDescription>Connect a Twitch bot for chat commands</CardDescription>
          </CardHeader>
          <CardContent>
            {user.data?.botAccount ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">
                    Connected as{" "}
                    <span className="font-medium">
                      {user.data.botAccount.displayName}
                    </span>
                  </p>
                  {botStatus.data?.running && botStatus.data.channel && (
                    <p className="text-xs text-muted-foreground">
                      In channel: #{botStatus.data.channel}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Scopes: {user.data.botAccount.scopes.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {botStatus.data?.running ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => stopBot.mutate()}
                      disabled={stopBot.isPending}
                      className="text-destructive"
                    >
                      <SquareStop className="size-3" />
                      Stop Bot
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startBot.mutate()}
                      disabled={startBot.isPending}
                    >
                      <Play className="size-3" />
                      Start Bot
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectBot.mutate()}
                    disabled={disconnectBot.isPending}
                  >
                    <Unplug className="size-3" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No bot account connected.
                </p>
                <a
                  href="/api/bot/authorize"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-twitch px-3 text-xs font-medium text-white hover:bg-twitch-hover"
                >
                  Connect Bot Account
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unified Settings Card with Tabs */}
        <Card>
          <CardContent className="px-4 pb-4 pt-4">
            <Tabs defaultValue="tasks">
              <TabsList>
                <TabsTrigger value="tasks">Task Commands</TabsTrigger>
                <TabsTrigger value="timer">Timer Commands</TabsTrigger>
                <TabsTrigger value="aliases">Aliases</TabsTrigger>
              </TabsList>

              {/* Task Commands Tab */}
              <TabsContent value="tasks" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Task Commands</p>
                    <p className="text-xs text-muted-foreground">Viewer task management via chat</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="task-commands-toggle" className="text-xs">
                      {taskCommandsEnabled ? "On" : "Off"}
                    </Label>
                    <Switch
                      id="task-commands-toggle"
                      checked={taskCommandsEnabled}
                      onCheckedChange={(checked) => { setTaskCommandsEnabled(checked); markUnsaved(); }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Command Reference</h3>
                  <CommandTable commands={taskCommands} />
                </div>

                <Separator />

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Messages</h3>
                  <TaskMessageEditor
                    messages={taskMessages}
                    onChange={handleTaskMessagesChange}
                    disabled={!taskCommandsEnabled}
                  />
                </div>
              </TabsContent>

              {/* Timer Commands Tab */}
              <TabsContent value="timer" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Timer Commands</p>
                    <p className="text-xs text-muted-foreground">Mod-only timer control via chat</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="timer-commands-toggle" className="text-xs">
                      {timerCommandsEnabled ? "On" : "Off"}
                    </Label>
                    <Switch
                      id="timer-commands-toggle"
                      checked={timerCommandsEnabled}
                      onCheckedChange={(checked) => { setTimerCommandsEnabled(checked); markUnsaved(); }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Command Reference</h3>
                  <CommandTable commands={timerCommands} />
                </div>

                <Separator />

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Messages</h3>
                  <TimerMessageEditor
                    messages={timerMessages}
                    onChange={handleTimerMessagesChange}
                    disabled={!timerCommandsEnabled}
                  />
                </div>
              </TabsContent>

              {/* Aliases Tab */}
              <TabsContent value="aliases" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Command Aliases</p>
                    <p className="text-xs text-muted-foreground">
                      Map custom command names to built-in commands (e.g. &quot;!t&quot; to &quot;!task&quot;)
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddAlias}>
                    <Plus className="size-3.5" />
                    Add Alias
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  {aliasEntries.map(([key, value], index) => (
                    <div key={index} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`alias-key-${index}`} className="text-xs">Alias</Label>
                        <Input
                          id={`alias-key-${index}`}
                          value={key}
                          onChange={(e) => handleAliasKeyChange(key, e.target.value)}
                          placeholder="!t"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`alias-cmd-${index}`} className="text-xs">Command</Label>
                        <Input
                          id={`alias-cmd-${index}`}
                          value={value}
                          onChange={(e) => handleAliasValueChange(key, e.target.value)}
                          placeholder="!task"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleAliasRemove(key)}
                        aria-label={`Remove alias ${key || "(empty)"}`}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  {aliasEntries.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No aliases configured. Click &quot;Add Alias&quot; to create one.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Save / Reset Bar */}
      {hasUnsaved && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <p className="text-sm text-muted-foreground">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isSaving}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 size-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
