"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, ListTodo, RefreshCw, Timer } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { TaskManager } from "@/components/task-manager";
import { TimerProvider, TimerDisplay, TimerSettings } from "@/components/timer-controls";
import { TimerStatusBadge } from "@/components/timer-status-badge";
import { trpc } from "@/utils/trpc";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Up late? Let's grind";
}

function getSubGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Ready to crush some tasks today?";
  if (hour >= 12 && hour < 17) return "Keep the momentum going!";
  if (hour >= 17 && hour < 21) return "Wrapping up the day's work?";
  return "Night owl mode activated.";
}

export default function Dashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const queryClient = useQueryClient();
  const user = useQuery(trpc.user.me.queryOptions());

  const regenerateToken = useMutation({
    ...trpc.user.regenerateOverlayToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("Overlay token regenerated");
    },
  });

  const copyUrl = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
  };

  const [showTimerPreview, setShowTimerPreview] = useState(false);
  const [showTasksPreview, setShowTasksPreview] = useState(false);
  const [showTimerToken, setShowTimerToken] = useState(false);
  const [showTasksToken, setShowTasksToken] = useState(false);

  const timerToken = user.data?.overlayTimerToken;
  const tasksToken = user.data?.overlayTasksToken;

  if (user.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Greeting + Status Badge */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold" suppressHydrationWarning>
            {getGreeting()}, {session.user.name}
          </h1>
          <p className="text-muted-foreground" suppressHydrationWarning>
            {getSubGreeting()}
          </p>
        </div>
        <TimerStatusBadge />
      </div>

      <div className="grid gap-6">
        {/* Timer: Controls + Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Timer</CardTitle>
            <CardDescription>Control your Pomodoro timer and see the overlay preview</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTimerPreview((v) => !v)}
                aria-pressed={showTimerPreview}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                {showTimerPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                Preview
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TimerProvider>
              <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
                {/* Left: Timer display */}
                <div className="flex-1">
                  <TimerDisplay />
                </div>
                {/* Middle: Settings */}
                <div className="flex-1">
                  <TimerSettings />
                </div>
                {/* Right: Preview */}
                <div
                  className="shrink-0 self-center overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/40"
                  style={{ width: 280, height: 280 }}
                >
                  {showTimerPreview && timerToken ? (
                    <iframe
                      src={`/overlay/t/${timerToken}`}
                      className="pointer-events-none"
                      style={{ width: 280, height: 280, border: "none", background: "transparent" }}
                      title="Timer overlay preview"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                      <EyeOff className="size-5 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground/60">Preview is disabled</p>
                      <Button variant="outline" size="sm" onClick={() => setShowTimerPreview(true)}>
                        Enable Preview
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TimerProvider>
          </CardContent>
        </Card>

        {/* Tasks: Manager + Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Manage tasks and see the overlay preview</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTasksPreview((v) => !v)}
                aria-pressed={showTasksPreview}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                {showTasksPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                Preview
              </Button>
            </CardAction>
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
              <div
                className="shrink-0 self-center overflow-hidden rounded-lg border border-dashed border-border/60 bg-muted/40"
                style={{ width: 350, height: 350 }}
              >
                {showTasksPreview && tasksToken ? (
                  <iframe
                    src={`/overlay/l/${tasksToken}`}
                    className="pointer-events-none"
                    style={{ width: 350, height: 350, border: "none", background: "transparent" }}
                    title="Task list overlay preview"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3">
                    <EyeOff className="size-5 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground/60">Preview is disabled</p>
                    <Button variant="outline" size="sm" onClick={() => setShowTasksPreview(true)}>
                      Enable Preview
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overlay URLs */}
        <Card>
          <CardHeader>
            <CardTitle>Overlay URLs</CardTitle>
            <CardDescription>Add these as browser sources in OBS</CardDescription>
          </CardHeader>
          <CardContent>
            {user.data ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Timer className="size-4 text-muted-foreground" />
                    Timer Overlay
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type={showTimerToken ? "text" : "password"}
                      readOnly
                      value={`/overlay/t/${user.data.overlayTimerToken}`}
                      className="flex-1 truncate rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setShowTimerToken((v) => !v)}
                      aria-label={showTimerToken ? "Hide timer overlay URL" : "Show timer overlay URL"}
                    >
                      {showTimerToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() =>
                        copyUrl(`/overlay/t/${user.data!.overlayTimerToken}`)
                      }
                      aria-label="Copy timer overlay URL"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => regenerateToken.mutate({ type: "timer" })}
                      disabled={regenerateToken.isPending}
                      aria-label="Regenerate timer overlay token"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ListTodo className="size-4 text-muted-foreground" />
                    Task List Overlay
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type={showTasksToken ? "text" : "password"}
                      readOnly
                      value={`/overlay/l/${user.data.overlayTasksToken}`}
                      className="flex-1 truncate rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setShowTasksToken((v) => !v)}
                      aria-label={showTasksToken ? "Hide task list overlay URL" : "Show task list overlay URL"}
                    >
                      {showTasksToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() =>
                        copyUrl(`/overlay/l/${user.data!.overlayTasksToken}`)
                      }
                      aria-label="Copy task list overlay URL"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => regenerateToken.mutate({ type: "tasks" })}
                      disabled={regenerateToken.isPending}
                      aria-label="Regenerate task list overlay token"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
