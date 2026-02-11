"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
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
import { TaskManager } from "@/components/task-manager";
import { TimerControls } from "@/components/timer-controls";
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

  const timerToken = user.data?.overlayTimerToken;
  const tasksToken = user.data?.overlayTasksToken;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold" suppressHydrationWarning>
          {getGreeting()}, {session.user.name}
        </h1>
        <p className="text-muted-foreground" suppressHydrationWarning>
          {getSubGreeting()}
        </p>
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
                className="gap-1.5 text-xs text-muted-foreground"
              >
                {showTimerPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                Preview
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
              <div className="flex-1">
                <TimerControls />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Preview</span>
                <div className="overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/40" style={{ width: "280px", height: "280px" }}>
                  {showTimerPreview && timerToken ? (
                    <iframe
                      src={`/overlay/t/${timerToken}`}
                      className="pointer-events-none"
                      style={{ width: "280px", height: "280px", border: "none", background: "transparent" }}
                      title="Timer overlay preview"
                    />
                  ) : null}
                </div>
              </div>
            </div>
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
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Preview</span>
                <div className="overflow-hidden rounded-lg border border-dashed border-border/60 bg-muted/40" style={{ width: "350px", height: "350px" }}>
                  {showTasksPreview && tasksToken ? (
                    <iframe
                      src={`/overlay/l/${tasksToken}`}
                      className="pointer-events-none"
                      style={{ width: "350px", height: "350px", border: "none", background: "transparent" }}
                      title="Task list overlay preview"
                    />
                  ) : null}
                </div>
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
      </div>
    </div>
  );
}
