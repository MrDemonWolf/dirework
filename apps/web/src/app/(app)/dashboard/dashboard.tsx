"use client";

// Owner dashboard home (/dashboard): the timer console (instrument | controls, settings and
// the timer-overlay monitor) and the task board (board | tasks-overlay monitor). The header's
// bot chip is the page's only bot status. All data comes from owner-only tRPC procedures:
// streamed from the server's one batched call on first load (page.tsx), then polled through
// the same-origin /rpc proxy.
//
// Progressive: the frame (greeting, panels, headings) is static and each data-backed section
// is a ProgressiveSection (components/progressive-section.tsx, lib/progressive.ts). The first
// paint carries every section whose data arrived within SECTIONS_READY_MS; a slower one shows
// its placeholder (same shape) and fills in on its own.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import type { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ConsoleRule } from "@/components/console-rule";
import {
  StatusClusterPlaceholder,
  TaskBoardPlaceholder,
  TimerConsoleBodyPlaceholder,
} from "@/components/dashboard-skeleton";
import { ProgressiveSection, SectionPlaceholder } from "@/components/progressive-section";
import { QueryError } from "@/components/query-error";
import { SecretUrlRow } from "@/components/secret-url-row";
import { SetupChecklist, SetupReopenButton, useSetupCollapsed } from "@/components/setup-checklist";
import { overlayPath } from "@/lib/overlay-view";
import { StatusChip } from "@/components/status-chip";
import { TaskManager } from "@/components/task-manager";
import {
  TimerInstrument,
  TimerProvider,
  TimerSettings,
  TimerTransport,
} from "@/components/timer-controls";
import { TimerStatusBadge } from "@/components/timer-status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setupProgress } from "@/lib/setup-steps";
import { describeTrpcError } from "@/lib/trpc-errors";
import { trpc } from "@/utils/trpc";

// Greeting, sub-greeting and date use the browser's local clock, which can differ from the
// server render, so their elements carry suppressHydrationWarning.
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Working late";
}

function getSubGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "What's first on the list?";
  if (hour >= 12 && hour < 17) return "Keep it going.";
  if (hour >= 17 && hour < 21) return "Wrapping up the day's work?";
  return "Burning the midnight oil?";
}

function getDateStr(): string {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })
    .replace(",", "");
}

/**
 * An overlay's monitor: labeled rule with the recommended OBS size, the masked URL row,
 * and a Live preview toggle. The preview is a live overlay iframe that polls the api on the
 * overlay cadence while shown, so it starts hidden and its stage only exists while on.
 */
function OverlayMonitor({
  label,
  noun,
  size,
  sizeHint,
  aspectRatio,
  src,
  show,
  onToggle,
  onRegenerate,
  regenerating,
}: {
  /** "Timer overlay" / "Tasks overlay": the rule and the URL row's accessible names. */
  label: string;
  noun: "timer" | "tasks";
  size: string;
  sizeHint: string;
  aspectRatio: string;
  src: string | null;
  show: boolean;
  onToggle: (next: boolean) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <ConsoleRule label={label} className="flex items-center">
        <SizeChip size={size} hint={sizeHint} />
      </ConsoleRule>
      <SecretUrlRow
        label={label}
        path={src}
        onRegenerate={onRegenerate}
        regenerating={regenerating}
        resetDescription={OVERLAY_RESET_DESCRIPTION}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-muted-foreground">Add the URL as a browser source in OBS</p>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onToggle(!show)}
          aria-pressed={show}
          disabled={!src}
          className="ml-auto gap-1.5"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          Live preview
          <span className="sr-only"> of the {noun} overlay</span>
        </Button>
      </div>
      {show && src && (
        <div
          className="panel-inset bg-grain relative w-full overflow-hidden"
          style={{ aspectRatio }}
        >
          <iframe
            src={src}
            title={`${label} preview`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ border: "none", background: "transparent" }}
          />
        </div>
      )}
    </div>
  );
}

/** Confirm-dialog body for resetting either overlay URL (the old token stops working). */
const OVERLAY_RESET_DESCRIPTION =
  "The current URL stops working immediately: any OBS browser source still using it goes blank (fully transparent) until you paste the new URL into OBS.";

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

/** Resetting an overlay URL: one mutation per monitor, with the shared toasts. */
function useRegenerateOverlayToken() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.user.regenerateOverlayToken.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      toast.success("New overlay URL ready — paste it into OBS");
    },
    onError: (err) => {
      toast.error(`Couldn't reset the URL: ${describeTrpcError(err)}`);
    },
  });
}

type SessionUser = (typeof authClient.$Infer.Session)["user"];

/**
 * Header band: console kicker + greeting (session only, so it is part of the frame) and the
 * status cluster, which the caller fills (placeholder or live chips). The cluster's bot chip
 * is the page's only bot status, and it links to Bot settings.
 */
function HeaderBand({ user, status }: { user: SessionUser; status: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="console-label mb-2" suppressHydrationWarning>
          Console — {getDateStr()}
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight" suppressHydrationWarning>
          {getGreeting()}, {user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
          {getSubGreeting()}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{status}</div>
    </div>
  );
}

/**
 * Header section (needs `user.me` + `timer.get`): the band's live status cluster (Setup
 * button, timer status, bot chip) and the "Set up streaming" checklist under it, which share
 * the checklist's collapsed state. Both render together so that state is decided from loaded
 * data, never from a pending `me`.
 */
function HeaderSection({ user }: { user: SessionUser }) {
  const me = useQuery(trpc.user.me.queryOptions());

  // Setup checklist: "Finish later" hides the card and the header band's Setup button
  // brings it back. Focus follows only those clicks: collapsing hands it to the button,
  // reopening to the card's heading. A transition driven by hydration or the stored choice
  // (no click) never moves focus.
  const [setupCollapsed, setSetupCollapsed] = useSetupCollapsed(
    // undefined until user.me loads (e.g. after a failed prefetch), so the collapse default
    // waits for real data.
    me.data ? setupProgress(me.data).nextStep === null : undefined,
  );
  const setupButtonRef = useRef<HTMLButtonElement>(null);
  const setupHeadingRef = useRef<HTMLHeadingElement>(null);
  const collapsedByClick = useRef(false);
  const reopenRequested = useRef(false);
  useEffect(() => {
    if (setupCollapsed && collapsedByClick.current) setupButtonRef.current?.focus();
    if (!setupCollapsed && reopenRequested.current) setupHeadingRef.current?.focus();
    collapsedByClick.current = false;
    reopenRequested.current = false;
  }, [setupCollapsed]);

  if (!me.data) {
    // The streamed `me` failed (or never streamed): the client refetches it on mount. Keep
    // the band's shape while it runs, then offer a retry if it fails too.
    return (
      <>
        <HeaderBand user={user} status={<StatusClusterPlaceholder />} />
        {!me.isFetching && (
          <QueryError
            title="Couldn't load your dashboard"
            onRetry={() => me.refetch()}
            retrying={me.isFetching}
            className="mb-8"
          />
        )}
      </>
    );
  }

  const botAccount = me.data.botAccount ?? null;

  return (
    <>
      <HeaderBand
        user={user}
        status={
          <>
            {setupCollapsed && (
              <SetupReopenButton
                me={me.data}
                buttonRef={setupButtonRef}
                onOpen={() => {
                  reopenRequested.current = true;
                  setSetupCollapsed(false);
                }}
              />
            )}
            <TimerStatusBadge />
            <Link
              href={"/dashboard/bot" as const}
              aria-label={
                botAccount ? "Bot ready, open Bot settings" : "Bot not connected, open Bot settings"
              }
              // A compact chip, so on touch screens the link itself gets the 44px hit area.
              className="inline-flex items-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            >
              <StatusChip
                tone={botAccount ? "accent" : "idle"}
                label={botAccount ? "Bot ready" : "Bot not connected"}
              />
            </Link>
          </>
        }
      />
      <SetupChecklist
        me={me.data}
        collapsed={setupCollapsed}
        headingRef={setupHeadingRef}
        onCollapse={() => {
          collapsedByClick.current = true;
          setSetupCollapsed(true);
        }}
      />
    </>
  );
}

/**
 * Timer console body (needs `timer.get` + `config.get`): instrument (3/5) | transport,
 * session settings and the timer-overlay monitor (2/5). The monitor's URL comes from
 * `user.me`; until that lands the row stays masked and disabled at the same size.
 */
function TimerConsoleBody() {
  const me = useQuery(trpc.user.me.queryOptions());
  const regenerateToken = useRegenerateOverlayToken();
  // Previews start hidden: each one is a live overlay iframe that polls the api on the
  // overlay cadence for as long as it is shown.
  const [showPreview, setShowPreview] = useState(false);

  return (
    <TimerProvider>
      <div className="grid lg:grid-cols-5">
        <div className="flex items-center justify-center px-5 py-8 lg:col-span-3">
          <TimerInstrument />
        </div>
        <div className="flex min-w-0 flex-col gap-5 border-t border-border/40 px-5 py-5 lg:col-span-2 lg:border-t-0 lg:border-l">
          <TimerTransport />
          <TimerSettings />
          <OverlayMonitor
            label="Timer overlay"
            noun="timer"
            size="300 × 300"
            sizeHint="Square OBS browser source — the timer scales to fill it"
            aspectRatio="1 / 1"
            src={overlayPath("timer", me.data?.overlayTimerToken)}
            show={showPreview}
            onToggle={setShowPreview}
            onRegenerate={() => regenerateToken.mutate({ type: "timer" })}
            regenerating={regenerateToken.isPending}
          />
        </div>
      </div>
    </TimerProvider>
  );
}

/** Task board (needs `task.list` + `user.me`, which pins the streamer's own group first). */
function TaskBoard() {
  const me = useQuery(trpc.user.me.queryOptions());
  const regenerateToken = useRegenerateOverlayToken();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <TaskManager
      userTwitchId={me.data?.twitchId ?? me.data?.id ?? ""}
      monitor={
        <OverlayMonitor
          label="Tasks overlay"
          noun="tasks"
          size="700 × 800"
          sizeHint="OBS browser source — the list fills it and scrolls when tasks overflow"
          aspectRatio="7 / 8"
          src={overlayPath("tasks", me.data?.overlayTasksToken)}
          show={showPreview}
          onToggle={setShowPreview}
          onRegenerate={() => regenerateToken.mutate({ type: "tasks" })}
          regenerating={regenerateToken.isPending}
        />
      }
    />
  );
}

/**
 * Dashboard home: the frame plus one `ProgressiveSection` per data-backed section. `session`
 * comes from the server page; the sections read the streamed queries.
 */
export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const meKey = trpc.user.me.queryKey();
  const timerKey = trpc.timer.get.queryKey();

  return (
    <div className="container mx-auto max-w-content px-4 py-8">
      <ProgressiveSection
        queryKeys={[meKey, timerKey]}
        fallback={
          <HeaderBand
            user={session.user}
            status={
              <SectionPlaceholder name="status">
                <StatusClusterPlaceholder />
              </SectionPlaceholder>
            }
          />
        }
      >
        <HeaderSection user={session.user} />
      </ProgressiveSection>

      <div className="grid gap-6">
        {/* Hero instrument: the timer console. Its heading is static, so it is frame. */}
        <section className="panel-hero">
          <div className="border-b border-border/40 px-5 pt-4 pb-3">
            <ConsoleRule label="Timer Console" />
            <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight">Pomodoro</h2>
            <p className="text-sm text-muted-foreground">
              Run the focus session your viewers see in OBS
            </p>
          </div>
          <ProgressiveSection
            queryKeys={[timerKey, trpc.config.get.queryKey()]}
            fallback={
              <SectionPlaceholder name="timer">
                <TimerConsoleBodyPlaceholder />
              </SectionPlaceholder>
            }
          >
            <TimerConsoleBody />
          </ProgressiveSection>
        </section>

        {/* Task board (2/3) with the tasks-overlay monitor (1/3) */}
        <section className="panel-hero min-w-0">
          <ProgressiveSection
            queryKeys={[trpc.task.list.queryKey(), meKey]}
            fallback={
              <SectionPlaceholder name="tasks">
                <TaskBoardPlaceholder />
              </SectionPlaceholder>
            }
          >
            <TaskBoard />
          </ProgressiveSection>
        </section>
      </div>
    </div>
  );
}
