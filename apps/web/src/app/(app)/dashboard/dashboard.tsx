"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConsoleRule } from "@/components/console-rule";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { StatusChip } from "@/components/status-chip";
import { TaskManager } from "@/components/task-manager";
import { TimerProvider, TimerInstrument, TimerSettings } from "@/components/timer-controls";
import { TimerStatusBadge } from "@/components/timer-status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/utils/trpc";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Working late";
}

function getSubGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Ready to crush some tasks today?";
  if (hour >= 12 && hour < 17) return "Keep the momentum going!";
  if (hour >= 17 && hour < 21) return "Wrapping up the day's work?";
  return "Night owl mode activated.";
}

function getDateStr(): string {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })
    .replace(",", "");
}

/** Inset monitor stage: labeled rule with an eye toggle + square overlay iframe. */
function OverlayMonitor({
  label,
  caption,
  src,
  title,
  show,
  onToggle,
}: {
  label: string;
  caption?: string;
  src: string | null;
  title: string;
  show: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <ConsoleRule label={label} className="min-w-0 flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onToggle(!show)}
          aria-pressed={show}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
      </div>
      <div
        className="panel-inset bg-grain relative w-full overflow-hidden"
        style={{ aspectRatio: "1 / 1" }}
      >
        {show && src ? (
          <iframe
            src={src}
            title={title}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ border: "none", background: "transparent" }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <EyeOff className="size-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Preview is off</p>
            <Button variant="outline" size="sm" onClick={() => onToggle(true)}>
              Show preview
            </Button>
          </div>
        )}
        {caption && (
          <span className="console-label absolute right-2 bottom-1.5">{caption}</span>
        )}
      </div>
    </div>
  );
}

/** Recommended OBS browser-source dimensions, shown beside each overlay URL. */
function SizeChip({ size, hint }: { size: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="ml-auto shrink-0 cursor-default rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {size}
          </span>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

function OverlayUrlRow({
  label,
  path,
  onCopy,
  onRegenerate,
  regenerating,
}: {
  label: string;
  path: string;
  onCopy: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [origin, setOrigin] = useState("");
  const [flash, setFlash] = useState(false);
  const prevPath = useRef(path);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // A changed token used to be invisible behind the mask — regen looked
  // broken. Now the row reveals the fresh URL and flashes to prove it changed.
  useEffect(() => {
    if (prevPath.current === path) return;
    prevPath.current = path;
    setRevealed(true);
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(timer);
  }, [path]);

  // Show the full origin-prefixed URL — what the user pastes into OBS.
  const fullUrl = origin ? `${origin}${path}` : path;
  // Last 6 chars of the token stay visible while masked, so the current
  // token is identifiable (and visibly different after a regenerate).
  const fingerprint = path.slice(-6);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        readOnly
        value={revealed ? fullUrl : `${"•".repeat(34)}${fingerprint}`}
        className={`panel-inset h-9 min-w-0 flex-1 truncate px-3 font-mono text-base transition-shadow md:text-sm ${
          flash ? "ring-2 ring-success" : ""
        }`}
        aria-hidden={revealed ? undefined : true}
        tabIndex={revealed ? undefined : -1}
        aria-label={revealed ? `${label} URL` : undefined}
      />
      {!revealed && (
        <span className="sr-only">{`${label} URL hidden — press Show to reveal`}</span>
      )}
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => setRevealed((v) => !v)}
        aria-pressed={revealed}
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
      <div aria-hidden className="mx-1 w-px self-stretch bg-border/40" />
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex">
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={regenerating}
                    aria-label={`Reset ${label} URL`}
                  >
                    <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                  </Button>
                }
                title={`Reset the ${label.toLowerCase()} URL?`}
                description="The current URL stops working immediately. Any OBS browser source using it will go blank until you copy the new URL and paste it back into OBS."
                confirmLabel="Reset URL"
                onConfirm={onRegenerate}
              />
            </span>
          }
        />
        <TooltipContent>Reset URL — the current one stops working</TooltipContent>
      </Tooltip>
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
      toast.success("New overlay URL ready — paste it into OBS");
    },
    onError: (err) => {
      toast.error(`Couldn't reset the URL: ${err.message}`);
    },
  });

  const copyUrl = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — click Show, then copy the URL yourself");
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
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header band: console kicker + greeting + LED status cluster */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="console-label mb-2" suppressHydrationWarning>
            Console — {getDateStr()}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight" suppressHydrationWarning>
            {getGreeting()}, {session.user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
            {getSubGreeting()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimerStatusBadge />
          <StatusChip
            tone={botAccount ? "accent" : "idle"}
            label={botAccount ? "Bot ready" : "Bot not connected"}
          />
        </div>
      </div>

      <div className="stagger-reveal grid gap-6 lg:grid-cols-3">
        {/* Hero instrument: the timer console — its overlay monitor lives beside it */}
        <section className="panel-hero lg:col-span-3">
          <div className="border-b border-border/40 px-5 pt-4 pb-3">
            <ConsoleRule label="Timer Console" />
            <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight">Pomodoro</h2>
            <p className="text-sm text-muted-foreground">
              Run the focus session your viewers see in OBS
            </p>
          </div>
          <TimerProvider>
            <div className="flex flex-col gap-8 px-5 py-6 lg:flex-row lg:items-stretch">
              <div className="flex flex-1 items-center justify-center py-2">
                <TimerInstrument />
              </div>
              <div className="w-full lg:w-60 lg:shrink-0 lg:border-l lg:border-border/40 lg:pl-6">
                <TimerSettings />
              </div>
              {/* Timer output — the OBS view of THIS timer, right where it's controlled */}
              <div className="w-full lg:w-72 lg:shrink-0 lg:border-l lg:border-border/40 lg:pl-6">
                {user.data ? (
                  <OverlayMonitor
                    label="Timer preview"
                    src={timerToken ? `/overlay/t/${timerToken}` : null}
                    title="Timer overlay preview"
                    show={showTimerPreview}
                    onToggle={setShowTimerPreview}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </div>
            </div>
          </TimerProvider>
          {/* Overlay URL — full-width strip along the bottom so the OBS source URL has room */}
          {user.data && (
            <div className="space-y-2 border-t border-border/40 px-5 py-4">
              <ConsoleRule label="Timer overlay URL" className="flex items-center">
                <SizeChip size="300 × 300" hint="Square OBS browser source — the timer scales to fill it" />
              </ConsoleRule>
              <OverlayUrlRow
                label="Timer overlay"
                path={`/overlay/t/${user.data.overlayTimerToken}`}
                onCopy={() => copyUrl(`/overlay/t/${user.data!.overlayTimerToken}`)}
                onRegenerate={() => regenerateToken.mutate({ type: "timer" })}
                regenerating={regenerateToken.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Add the URL as a browser source in OBS
              </p>
            </div>
          )}
        </section>

        {/* Task board — its overlay monitor sits right beside it */}
        <section className="panel min-w-0 lg:col-span-2">
          {user.data ? (
            <TaskManager
              userTwitchId={user.data.twitchId ?? ""}
              username={user.data.name}
              displayName={user.data.displayName ?? user.data.name}
            />
          ) : (
            <p className="p-5 text-sm text-muted-foreground">Loading...</p>
          )}
        </section>

        {/* Tasks output — the OBS view of the task list */}
        <section className="panel min-w-0">
          <div className="border-b border-border/40 px-5 pt-4 pb-3">
            <ConsoleRule label="Tasks Output" />
            <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight">
              Task list overlay
            </h2>
            <p className="text-sm text-muted-foreground">
              Add the URL as a browser source in OBS
            </p>
          </div>
          <div className="space-y-2 px-5 py-5">
            {user.data ? (
              <OverlayMonitor
                label="Tasks preview"
                src={tasksToken ? `/overlay/l/${tasksToken}` : null}
                title="Task list overlay preview"
                show={showTasksPreview}
                onToggle={setShowTasksPreview}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>
          {/* Tasks overlay URL lives WITH the panel that explains it — the old
              detached full-width strip sat opposite to where the timer's URL was. */}
          {user.data && (
            <div className="space-y-2 border-t border-border/40 px-5 py-4">
              <ConsoleRule label="Tasks overlay URL" className="flex items-center">
                <SizeChip size="700 × 800" hint="OBS browser source — the list fills it and scrolls when tasks overflow" />
              </ConsoleRule>
              <OverlayUrlRow
                label="Tasks overlay"
                path={`/overlay/l/${user.data.overlayTasksToken}`}
                onCopy={() => copyUrl(`/overlay/l/${user.data!.overlayTasksToken}`)}
                onRegenerate={() => regenerateToken.mutate({ type: "tasks" })}
                regenerating={regenerateToken.isPending}
              />
            </div>
          )}
        </section>

        {/* Bot quick status — slim full-width strip */}
        <section className="panel lg:col-span-3">
          <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10">
                <Bot className="size-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                {botAccount ? (
                  <>
                    <p className="truncate text-sm font-medium">{botAccount.displayName}</p>
                    <StatusChip tone="accent" label="Ready" className="mt-1" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">No bot account</p>
                    <StatusChip tone="idle" label="Not connected" className="mt-1" />
                  </>
                )}
              </div>
            </div>
            {botAccount && (
              <p className="font-mono text-xs text-muted-foreground">
                !task · !done · !timer · !help
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="justify-center gap-2 sm:w-auto"
              nativeButton={false}
              render={<Link href={"/dashboard/bot" as const} />}
            >
              {botAccount ? "Bot settings & console" : "Connect bot account"}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
