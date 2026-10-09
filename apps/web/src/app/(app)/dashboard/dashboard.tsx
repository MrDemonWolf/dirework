"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import type { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ConsoleRule } from "@/components/console-rule";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { QueryError } from "@/components/query-error";
import { SecretUrlRow } from "@/components/secret-url-row";
import { StatusChip } from "@/components/status-chip";
import { TaskManager } from "@/components/task-manager";
import { TimerProvider, TimerInstrument, TimerSettings } from "@/components/timer-controls";
import { TimerStatusBadge } from "@/components/timer-status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeTrpcError } from "@/lib/trpc-errors";
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
          aria-label={`Show ${label.toLowerCase()}`}
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
        {caption && <span className="console-label absolute right-2 bottom-1.5">{caption}</span>}
      </div>
    </div>
  );
}

const OVERLAY_RESET_DESCRIPTION =
  "The current URL stops working immediately. Any OBS browser source using it will go blank until you copy the new URL and paste it back into OBS.";

/** Recommended OBS browser-source dimensions, shown beside each overlay URL. */
function SizeChip({ size, hint }: { size: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Recommended size ${size}: ${hint}`}
            className="ml-auto shrink-0 cursor-default rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {size}
          </button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const queryClient = useQueryClient();
  const user = useQuery(trpc.user.me.queryOptions());

  const regenerateToken = useMutation({
    ...trpc.user.regenerateOverlayToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("New overlay URL ready — paste it into OBS");
    },
    onError: (err) => {
      toast.error(`Couldn't reset the URL: ${describeTrpcError(err)}`);
    },
  });

  const [showTimerPreview, setShowTimerPreview] = useState(false);
  const [showTasksPreview, setShowTasksPreview] = useState(false);

  if (user.isPending) {
    return <DashboardSkeleton />;
  }

  const me = user.data;
  if (!me) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <QueryError
          title="Couldn't load your dashboard"
          onRetry={() => user.refetch()}
          retrying={user.isFetching}
        />
      </div>
    );
  }

  const timerToken = me.overlayTimerToken;
  const tasksToken = me.overlayTasksToken;
  const botAccount = me.botAccount ?? null;

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

      <div className="stagger-reveal grid items-start gap-6 lg:grid-cols-3">
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
                <OverlayMonitor
                  label="Timer preview"
                  src={timerToken ? `/overlay/t/${timerToken}` : null}
                  title="Timer overlay preview"
                  show={showTimerPreview}
                  onToggle={setShowTimerPreview}
                />
              </div>
            </div>
          </TimerProvider>
          {/* Overlay URL — full-width strip along the bottom so the OBS source URL has room */}
          <div className="space-y-2 border-t border-border/40 px-5 py-4">
            <ConsoleRule label="Timer overlay URL" className="flex items-center">
              <SizeChip
                size="300 × 300"
                hint="Square OBS browser source — the timer scales to fill it"
              />
            </ConsoleRule>
            <SecretUrlRow
              label="Timer overlay"
              path={`/overlay/t/${timerToken}`}
              onRegenerate={() => regenerateToken.mutate({ type: "timer" })}
              regenerating={regenerateToken.isPending}
              resetDescription={OVERLAY_RESET_DESCRIPTION}
            />
            <p className="text-xs text-muted-foreground">Add the URL as a browser source in OBS</p>
          </div>
        </section>

        {/* Task board — hero console mirroring the timer: board + live preview
            beside it, overlay URL strip along the bottom */}
        <section className="panel-hero min-w-0 lg:col-span-3">
          <TaskManager
            userTwitchId={me.twitchId ?? me.id}
            // Tasks output — the OBS view of THIS list, top-aligned beside the
            // add-task block, mirroring the timer console's settings|preview row.
            preview={
              <OverlayMonitor
                label="Tasks preview"
                src={tasksToken ? `/overlay/l/${tasksToken}` : null}
                title="Task list overlay preview"
                show={showTasksPreview}
                onToggle={setShowTasksPreview}
              />
            }
          />
          {/* Tasks overlay URL — full-width strip along the bottom, mirroring
              the timer console's own overlay-URL strip. */}
          <div className="space-y-2 border-t border-border/40 px-5 py-4">
            <ConsoleRule label="Tasks overlay URL" className="flex items-center">
              <SizeChip
                size="700 × 800"
                hint="OBS browser source — the list fills it and scrolls when tasks overflow"
              />
            </ConsoleRule>
            <SecretUrlRow
              label="Tasks overlay"
              path={`/overlay/l/${tasksToken}`}
              onRegenerate={() => regenerateToken.mutate({ type: "tasks" })}
              regenerating={regenerateToken.isPending}
              resetDescription={OVERLAY_RESET_DESCRIPTION}
            />
            <p className="text-xs text-muted-foreground">Add the URL as a browser source in OBS</p>
          </div>
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
