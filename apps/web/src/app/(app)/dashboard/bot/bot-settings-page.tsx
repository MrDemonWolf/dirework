"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import type {
  TaskMessagesConfig,
  TimerMessagesConfig,
  PhaseLabelsConfig,
  CommandAliasesConfig,
} from "@/lib/config-types";
import { extractTaskMessages, extractTimerMessages, extractPhaseLabels } from "@/lib/config-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TaskMessageEditor, TimerMessageEditor } from "@/components/bot-settings/message-editor";
import { CommandAliasEditor } from "@/components/bot-settings/command-alias-editor";
import { PhaseLabelsEditor } from "@/components/bot-settings/phase-labels-editor";
import { TaskVariableReference, TimerVariableReference } from "@/components/bot-settings/variable-reference";
import { trpc } from "@/utils/trpc";

const defaultTaskMessages: TaskMessagesConfig = {
  taskAdded: 'Awooo! The task "{task}" has been added to the pack, {user}!',
  noTaskAdded: "You're already on the hunt {user}, use !check to see your current task!",
  noTaskContent: "Tell the pack what you're working on! Use !add [task] {user}",
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

const defaultPhaseLabels: PhaseLabelsConfig = {
  idle: "Ready",
  starting: "Starting",
  work: "Focus",
  break: "Break",
  longBreak: "Long Break",
  paused: "Paused",
  finished: "Done",
};

const defaultCommandAliases: CommandAliasesConfig = {};

function BotSettingsSkeleton() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-6">
        {/* Bot account card skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-40" />
          </CardContent>
        </Card>
        <Separator />
        {/* Section skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-10" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BotSettingsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const config = useQuery(trpc.config.get.queryOptions());
  const user = useQuery(trpc.user.me.queryOptions());

  // Handle bot connection callback params
  useEffect(() => {
    const botStatus = searchParams.get("bot");
    if (botStatus === "connected") {
      toast.success("Bot account connected successfully!");
      window.history.replaceState({}, "", "/dashboard/bot");
    } else if (botStatus === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      toast.error(`Failed to connect bot account: ${reason}`);
      window.history.replaceState({}, "", "/dashboard/bot");
    }
  }, [searchParams]);

  // Working state
  const [taskCommandsEnabled, setTaskCommandsEnabled] = useState(true);
  const [timerCommandsEnabled, setTimerCommandsEnabled] = useState(true);
  const [taskMessages, setTaskMessages] = useState<TaskMessagesConfig>(defaultTaskMessages);
  const [timerMessages, setTimerMessages] = useState<TimerMessagesConfig>(defaultTimerMessages);
  const [phaseLabels, setPhaseLabels] = useState<PhaseLabelsConfig>(defaultPhaseLabels);
  const [commandAliases, setCommandAliases] = useState<CommandAliasesConfig>(defaultCommandAliases);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Saved state (for reset)
  const [savedTaskCommandsEnabled, setSavedTaskCommandsEnabled] = useState(true);
  const [savedTimerCommandsEnabled, setSavedTimerCommandsEnabled] = useState(true);
  const [savedTaskMessages, setSavedTaskMessages] = useState<TaskMessagesConfig>(defaultTaskMessages);
  const [savedTimerMessages, setSavedTimerMessages] = useState<TimerMessagesConfig>(defaultTimerMessages);
  const [savedPhaseLabels, setSavedPhaseLabels] = useState<PhaseLabelsConfig>(defaultPhaseLabels);
  const [savedCommandAliases, setSavedCommandAliases] = useState<CommandAliasesConfig>(defaultCommandAliases);

  // Once config loads, extract values from DB columns
  useEffect(() => {
    if (config.data) {
      const data = config.data;
      const tMsgs = extractTaskMessages(data);
      const tmMsgs = extractTimerMessages(data);
      const labels = extractPhaseLabels(data);
      const aliases = (data.commandAliases ?? {}) as CommandAliasesConfig;

      setTaskCommandsEnabled(data.taskCommandsEnabled);
      setTimerCommandsEnabled(data.timerCommandsEnabled);
      setTaskMessages(tMsgs);
      setTimerMessages(tmMsgs);
      setPhaseLabels(labels);
      setCommandAliases(aliases);

      setSavedTaskCommandsEnabled(data.taskCommandsEnabled);
      setSavedTimerCommandsEnabled(data.timerCommandsEnabled);
      setSavedTaskMessages(tMsgs);
      setSavedTimerMessages(tmMsgs);
      setSavedPhaseLabels(labels);
      setSavedCommandAliases(aliases);
    }
  }, [config.data]);

  const disconnectBot = useMutation({
    ...trpc.user.disconnectBot.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("Bot account disconnected");
    },
  });

  const updateMessagesMutation = useMutation({
    ...trpc.config.updateMessages.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  const updatePhaseLabelsMutation = useMutation({
    ...trpc.config.updatePhaseLabels.mutationOptions(),
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
    updatePhaseLabelsMutation.isPending ||
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

  const handlePhaseLabelsChange = useCallback((newLabels: PhaseLabelsConfig) => {
    setPhaseLabels(newLabels);
    setHasUnsaved(true);
  }, []);

  const handleAliasesChange = useCallback((newAliases: CommandAliasesConfig) => {
    setCommandAliases(newAliases);
    setHasUnsaved(true);
  }, []);

  const handleReset = useCallback(() => {
    setTaskCommandsEnabled(savedTaskCommandsEnabled);
    setTimerCommandsEnabled(savedTimerCommandsEnabled);
    setTaskMessages(savedTaskMessages);
    setTimerMessages(savedTimerMessages);
    setPhaseLabels(savedPhaseLabels);
    setCommandAliases(savedCommandAliases);
    setHasUnsaved(false);
  }, [
    savedTaskCommandsEnabled,
    savedTimerCommandsEnabled,
    savedTaskMessages,
    savedTimerMessages,
    savedPhaseLabels,
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
      await updatePhaseLabelsMutation.mutateAsync(phaseLabels);
      await updateAliasesMutation.mutateAsync({
        commandAliases: commandAliases,
      });

      setSavedTaskCommandsEnabled(taskCommandsEnabled);
      setSavedTimerCommandsEnabled(timerCommandsEnabled);
      setSavedTaskMessages(taskMessages);
      setSavedTimerMessages(timerMessages);
      setSavedPhaseLabels(phaseLabels);
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
    phaseLabels,
    commandAliases,
    updateMessagesMutation,
    updatePhaseLabelsMutation,
    updateAliasesMutation,
  ]);

  if (config.isLoading) {
    return <BotSettingsSkeleton />;
  }

  return (
    <div className={cn("container mx-auto max-w-2xl px-4 py-8", hasUnsaved && "pb-24")}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bot Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your bot account, response messages, phase labels, and command aliases
        </p>
      </div>

      <div className="space-y-6">
        {/* Bot Account */}
        <Card>
          <CardHeader>
            <CardTitle>Bot Account</CardTitle>
            <CardDescription>Connect a Twitch bot for chat commands</CardDescription>
          </CardHeader>
          <CardContent>
            {user.data?.botAccount ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm">
                    Connected as{" "}
                    <span className="font-medium">
                      {user.data.botAccount.displayName}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scopes: {user.data.botAccount.scopes.join(", ")}
                  </p>
                </div>
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
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No bot account connected.
                </p>
                <a
                  href="/api/bot/authorize"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#9146FF] px-3 text-xs font-medium text-white hover:bg-[#7c3ae6]"
                >
                  Connect Bot Account
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Task Commands */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Task Commands</h2>
              <p className="text-xs text-muted-foreground">
                Enable or disable task-related chat commands
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="task-commands-toggle" className="text-sm">
                {taskCommandsEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="task-commands-toggle"
                checked={taskCommandsEnabled}
                onCheckedChange={(checked) => {
                  setTaskCommandsEnabled(checked);
                  markUnsaved();
                }}
              />
            </div>
          </div>
          <TaskVariableReference />
          <TaskMessageEditor
            messages={taskMessages}
            onChange={handleTaskMessagesChange}
            disabled={!taskCommandsEnabled}
          />
        </div>

        <Separator />

        {/* Timer Commands */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Timer Commands</h2>
              <p className="text-xs text-muted-foreground">
                Enable or disable timer-related chat commands
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="timer-commands-toggle" className="text-sm">
                {timerCommandsEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="timer-commands-toggle"
                checked={timerCommandsEnabled}
                onCheckedChange={(checked) => {
                  setTimerCommandsEnabled(checked);
                  markUnsaved();
                }}
              />
            </div>
          </div>
          <TimerVariableReference />
          <TimerMessageEditor
            messages={timerMessages}
            onChange={handleTimerMessagesChange}
            disabled={!timerCommandsEnabled}
          />
        </div>

        <Separator />

        {/* Phase Labels */}
        <PhaseLabelsEditor labels={phaseLabels} onChange={handlePhaseLabelsChange} />

        <Separator />

        {/* Command Aliases */}
        <CommandAliasEditor
          aliases={commandAliases}
          onChange={handleAliasesChange}
        />
      </div>

      {/* Sticky Save / Reset Bar */}
      {hasUnsaved && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
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
