"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TaskManager } from "@/components/task-manager";
import { TimerControls } from "@/components/timer-controls";
import { TimerDisplay } from "@/components/timer-display";
import { TaskListDisplay } from "@/components/task-list-display";
import { trpc } from "@/utils/trpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const defaultTimerDisplayConfig = {
  dimensions: { width: "180px", height: "180px" },
  background: { color: "#000000", opacity: 0.5, borderRadius: "50%" },
  text: { color: "#ffffff", outlineColor: "#000000", outlineSize: "0px", fontFamily: "Inter" },
  fontSizes: { label: "16px", time: "32px", cycle: "14px" },
  labels: { work: "Focus", break: "Break", longBreak: "Long Break", starting: "Starting", finished: "Done" },
  showHours: false,
};

const defaultTaskDisplayConfig = {
  display: { showDone: true, showCount: true, useCheckboxes: true, crossOnDone: true, numberOfLines: 2 },
  fonts: { header: "Inter", body: "Inter" },
  scroll: { pixelsPerSecond: 0, gapBetweenLoops: 0 },
  header: {
    height: "36px",
    background: { color: "#000000", opacity: 0.9 },
    border: { color: "#ffffff", width: "1px", radius: "6px 6px 0 0" },
    fontSize: "14px",
    fontColor: "#ffffff",
    padding: "8px",
  },
  body: {
    background: { color: "#000000", opacity: 0.7 },
    border: { color: "#ffffff", width: "0px", radius: "0 0 6px 6px" },
    padding: { vertical: "4px", horizontal: "4px" },
  },
  task: {
    background: { color: "#000000", opacity: 0.6 },
    border: { color: "#000000", width: "0px", radius: "4px" },
    fontSize: "12px",
    fontColor: "#ffffff",
    usernameColor: "#a78bfa",
    padding: "6px 8px",
    marginBottom: "3px",
    maxWidth: "100%",
    direction: "row",
  },
  taskDone: { background: { color: "#000000", opacity: 0.3 }, fontColor: "#bbbbbb" },
  checkbox: {
    size: "14px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#ffffff", width: "1px", radius: "2px" },
    margin: { top: "3px", left: "0px", right: "4px" },
    tickChar: "\u2714",
    tickSize: "10px",
    tickColor: "#22c55e",
  },
  bullet: { char: "\u2022", size: "14px", color: "#ffffff", margin: { top: "0px", left: "0px", right: "4px" } },
};

export default function Dashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const queryClient = useQueryClient();
  const user = useQuery(trpc.user.me.queryOptions());
  const config = useQuery(trpc.config.get.queryOptions());
  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 1000,
  });
  const tasks = useQuery({
    ...trpc.task.list.queryOptions(),
    refetchInterval: 3000,
  });

  const regenerateToken = useMutation({
    ...trpc.user.regenerateOverlayToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("Overlay token regenerated");
    },
  });

  const disconnectBot = useMutation({
    ...trpc.user.disconnectBot.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("Bot account disconnected");
    },
  });

  const copyUrl = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
  };

  // Build timer preview state
  const timerState = timer.data ?? {
    status: "idle",
    targetEndTime: null,
    pausedWithRemaining: null,
    currentCycle: 1,
    totalCycles: 4,
  };

  // Build task preview data
  const taskList = tasks.data ?? [];
  const previewTasks = taskList.slice(0, 5).map((t: AnyRecord) => ({
    id: t.id,
    authorDisplayName: t.authorDisplayName,
    authorColor: t.authorColor,
    text: t.text,
    status: t.status,
  }));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {session.user.name}</p>
      </div>

      <div className="grid gap-6">
        {/* Timer: Controls + Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Timer</CardTitle>
            <CardDescription>Control your Pomodoro timer and see the overlay preview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex-1">
                <TimerControls />
              </div>
              <div className="flex items-center justify-center rounded-lg bg-zinc-900 p-4">
                {timerState.status === "idle" ? (
                  <div
                    className="flex flex-col items-center justify-center text-zinc-500"
                    style={{ width: "180px", height: "180px" }}
                  >
                    <p className="text-xs">Timer preview</p>
                    <p className="text-xs text-zinc-600">Start timer to see</p>
                  </div>
                ) : (
                  <TimerDisplay
                    config={defaultTimerDisplayConfig}
                    state={{
                      status: timerState.status,
                      targetEndTime: timerState.targetEndTime
                        ? typeof timerState.targetEndTime === "string"
                          ? timerState.targetEndTime
                          : (timerState.targetEndTime as Date).toISOString()
                        : null,
                      pausedWithRemaining: timerState.pausedWithRemaining,
                      currentCycle: timerState.currentCycle,
                      totalCycles: timerState.totalCycles,
                    }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks: Manager + Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Manage tasks and see the overlay preview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex-1">
                {user.data ? (
                  <TaskManager
                    userTwitchId={user.data.twitchId ?? ""}
                    username={user.data.name}
                    displayName={user.data.displayName ?? user.data.name}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </div>
              <div className="w-full rounded-lg bg-zinc-900 p-4 md:w-72">
                <div style={{ height: "300px" }}>
                  <TaskListDisplay
                    config={defaultTaskDisplayConfig}
                    tasks={previewTasks}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Overlay URLs */}
          <Card>
            <CardHeader>
              <CardTitle>Overlay URLs</CardTitle>
              <CardDescription>Add these as browser sources in OBS</CardDescription>
            </CardHeader>
            <CardContent>
              {user.data ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Timer Overlay
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                        /overlay/t/{user.data.overlayTimerToken}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          copyUrl(`/overlay/t/${user.data!.overlayTimerToken}`)
                        }
                        title="Copy URL"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => regenerateToken.mutate({ type: "timer" })}
                        disabled={regenerateToken.isPending}
                        title="Regenerate token"
                      >
                        <RefreshCw className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Task List Overlay
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                        /overlay/l/{user.data.overlayTasksToken}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          copyUrl(`/overlay/l/${user.data!.overlayTasksToken}`)
                        }
                        title="Copy URL"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => regenerateToken.mutate({ type: "tasks" })}
                        disabled={regenerateToken.isPending}
                        title="Regenerate token"
                      >
                        <RefreshCw className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
            </CardContent>
          </Card>

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
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-[#9146FF] px-3 text-xs font-medium text-white hover:bg-[#7c3ae6]"
                  >
                    Connect Bot Account
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
