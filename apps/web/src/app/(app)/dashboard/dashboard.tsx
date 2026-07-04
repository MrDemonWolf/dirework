"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Copy, Eye, EyeOff, ListTodo, RefreshCw, Timer } from "lucide-react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { StatusChip } from "@/components/status-chip";
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

function OverlayUrlRow({
  icon: Icon,
  label,
  path,
  onCopy,
  onRegenerate,
  regenerating,
}: {
  icon: typeof Timer;
  label: string;
  path: string;
  onCopy: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type={revealed ? "text" : "password"}
          readOnly
          value={path}
          className="h-9 flex-1 truncate rounded-lg border bg-muted/30 px-3 font-mono text-base md:h-8 md:text-xs"
          aria-label={`${label} URL`}
        />
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? `Hide ${label} URL` : `Show ${label} URL`}
        >
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={onCopy}
          aria-label={`Copy ${label} URL`}
        >
          <Copy className="size-3.5" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              disabled={regenerating}
              aria-label={`Regenerate ${label} token`}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          }
          title={`Regenerate the ${label.toLowerCase()} token?`}
          description="The current URL stops working immediately. Any OBS browser source using it will go blank until you copy the new URL and paste it back into OBS."
          confirmLabel="Regenerate token"
          onConfirm={onRegenerate}
        />
      </div>
    </div>
  );
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
      toast.success("Overlay token regenerated — paste the new URL into OBS");
    },
    onError: (err) => {
      toast.error(`Couldn't regenerate the token: ${err.message}`);
    },
  });

  const copyUrl = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — copy the URL manually");
    }
  };

  const [showTimerPreview, setShowTimerPreview] = useState(false);
  const [showTasksPreview, setShowTasksPreview] = useState(false);

  const timerToken = user.data?.overlayTimerToken;
  const tasksToken = user.data?.overlayTasksToken;
  const botAccount = user.data?.botAccount ?? null;

  if (user.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Greeting + Status Badge */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight" suppressHydrationWarning>
            {getGreeting()}, {session.user.name}
          </h1>
          <p className="text-muted-foreground" suppressHydrationWarning>
            {getSubGreeting()}
          </p>
        </div>
        <TimerStatusBadge />
      </div>

      <div className="stagger-reveal grid gap-6">
        {/* Timer console: hero module + settings + preview */}
        <Card className="relative overflow-visible">
          <CardHeader>
            <p className="console-label">Timer Console</p>
            <CardTitle className="font-heading text-base">Pomodoro</CardTitle>
            <CardDescription>Run the focus session your viewers see in OBS</CardDescription>
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
              <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
                {/* Hero timer module */}
                <div className="flex-1 py-2">
                  <TimerDisplay />
                </div>
                {/* Session settings */}
                <div className="w-full max-w-56 lg:w-56">
                  <TimerSettings />
                </div>
                {/* OBS-style preview */}
                <div
                  className="bg-grain shrink-0 self-center overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/40"
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

        {/* Tasks: manager + preview */}
        <Card>
          <CardHeader>
            <p className="console-label">Task Board</p>
            <CardTitle className="font-heading text-base">Tasks</CardTitle>
            <CardDescription>Yours and chat&apos;s, grouped by author</CardDescription>
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
              <div className="min-w-0 flex-1">
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
                className="bg-grain shrink-0 self-center overflow-hidden rounded-xl border border-dashed border-border/60 bg-muted/40"
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

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Overlay URLs */}
          <Card>
            <CardHeader>
              <p className="console-label">Outputs</p>
              <CardTitle className="font-heading text-base">Overlay URLs</CardTitle>
              <CardDescription>Add these as browser sources in OBS</CardDescription>
            </CardHeader>
            <CardContent>
              {user.data ? (
                <div className="space-y-4">
                  <OverlayUrlRow
                    icon={Timer}
                    label="Timer Overlay"
                    path={`/overlay/t/${user.data.overlayTimerToken}`}
                    onCopy={() => copyUrl(`/overlay/t/${user.data!.overlayTimerToken}`)}
                    onRegenerate={() => regenerateToken.mutate({ type: "timer" })}
                    regenerating={regenerateToken.isPending}
                  />
                  <OverlayUrlRow
                    icon={ListTodo}
                    label="Task List Overlay"
                    path={`/overlay/l/${user.data.overlayTasksToken}`}
                    onCopy={() => copyUrl(`/overlay/l/${user.data!.overlayTasksToken}`)}
                    onRegenerate={() => regenerateToken.mutate({ type: "tasks" })}
                    regenerating={regenerateToken.isPending}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
            </CardContent>
          </Card>

          {/* Bot quick status */}
          <Card>
            <CardHeader>
              <p className="console-label">Chat Bot</p>
              <CardTitle className="font-heading text-base">Bot</CardTitle>
              <CardDescription>Chat commands for tasks and the timer</CardDescription>
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="size-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  {botAccount ? (
                    <>
                      <p className="truncate text-sm font-medium">{botAccount.displayName}</p>
                      <StatusChip tone="live" label="Connected" className="mt-1" />
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">No bot account</p>
                      <StatusChip tone="idle" label="Not connected" className="mt-1" />
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between"
                nativeButton={false}
                render={<Link href={"/dashboard/bot" as const} />}
              >
                {botAccount ? "Bot settings & console" : "Connect the bot"}
                <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
