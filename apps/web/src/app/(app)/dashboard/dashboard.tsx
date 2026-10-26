"use client";

// Owner dashboard home (/dashboard): the timer console (instrument | controls, the owner's
// active task, settings and the OBS sources with both overlay URLs) and the full-width task
// board. The header's
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
import { useQuery } from "@tanstack/react-query";

import type { authClient } from "@/lib/auth-client";
import {
  FocusChartPlaceholder,
  StatTilesPlaceholder,
  StatusClusterPlaceholder,
  TaskBoardPlaceholder,
  TimerConsoleBodyPlaceholder,
} from "@/components/dashboard-skeleton";
import {
  FocusChart,
  StatTiles,
  useStatsRefresh,
  useTimeZoneSync,
} from "@/components/dashboard-stats";
import { ProgressiveSection, SectionPlaceholder } from "@/components/progressive-section";
import { QueryError } from "@/components/query-error";
import { ObsSources } from "@/components/obs-sources";
import { SetupChecklist, SetupReopenButton, useSetupCollapsed } from "@/components/setup-checklist";
import { StatusChip } from "@/components/status-chip";
import { TaskManager } from "@/components/task-manager";
import {
  TimerInstrument,
  TimerPhaseChip,
  TimerProvider,
  TimerSettings,
  TimerTransport,
} from "@/components/timer-controls";
import { TimerStatusBadge } from "@/components/timer-status-badge";
import { scheduleBotPresenceCheck } from "@/lib/bot-presence";
import { dashboardBotChip } from "@/lib/bot-status";
import { formatGreeting, pickGreeting } from "@/lib/greetings";
import { PANEL_HEADER_CLASS, PANEL_TITLE_CLASS } from "@/lib/panel-header";
import { setupProgress } from "@/lib/setup-steps";
import { ownerActiveTask, ownerAuthorKey } from "@/lib/task-utils";
import { trpc } from "@/utils/trpc";

// Greeting (lib/greetings.ts) and date use the browser's local clock, which can differ from
// the server render, so their elements carry suppressHydrationWarning.
function getDateStr(): string {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })
    .replace(",", "");
}

type SessionUser = (typeof authClient.$Infer.Session)["user"];

/**
 * Header band: console kicker + greeting (session only, so it is part of the frame) and the
 * status cluster, which the caller fills (placeholder or live chips). The cluster's bot chip
 * is the page's only bot status, and it links to Bot settings.
 */
function HeaderBand({ user, status }: { user: SessionUser; status: React.ReactNode }) {
  const greeting = formatGreeting(pickGreeting(new Date()), user.name);
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="console-label mb-2" suppressHydrationWarning>
          Console — {getDateStr()}
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight" suppressHydrationWarning>
          {greeting.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
          {greeting.subline}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{status}</div>
    </div>
  );
}

/**
 * Keeps the bot chip honest without a poll: when the lease in the last `user.me` answer
 * would have run out, refetch `user.me` once (visible tab only, at most once per lease
 * window) and let the fresh answer decide (lib/bot-presence.ts). While the last answer
 * said no bot page runs, nothing is scheduled: a page coming online shows on the next
 * `user.me` fetch (load, focus, an action that refreshes it).
 */
function useBotPresenceCheck(
  seenMsAgo: number | null | undefined,
  fetchedAt: number,
  refetch: () => unknown,
): void {
  const lastCheck = useRef(Number.NEGATIVE_INFINITY);
  const [wake, setWake] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `wake` re-arms the check after a failed refetch or when the tab becomes visible.
  useEffect(
    () =>
      scheduleBotPresenceCheck({
        seenMsAgo,
        fetchedAt,
        lastCheck,
        refetch,
        rerun: () => setWake((n) => n + 1),
      }),
    [seenMsAgo, fetchedAt, refetch, wake],
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
  // Stats bucket by the owner's local day: report this browser's zone if it differs.
  useTimeZoneSync(me.data ? me.data.timeZone : undefined);

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

  useBotPresenceCheck(me.data?.botPageSeenMsAgo, me.dataUpdatedAt, me.refetch);

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

  const botChip = dashboardBotChip(me.data.botAccount != null, me.data.botPageSeenMsAgo);

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
              aria-label={`${botChip.label}, open Bot settings`}
              // A compact chip, so on touch screens the link itself gets the 44px hit area.
              className="inline-flex items-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            >
              <StatusChip tone={botChip.tone} label={botChip.label} />
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
 * Timer console (needs `timer.get` + `config.get`): the one-line heading with the phase chip,
 * then instrument (3/5) | transport, the owner's active task, session settings and the OBS
 * sources (2/5). "Now" and the overlay URLs read `task.list` / `user.me` from the cache the
 * page's one batch filled; they never fetch on their own and fill in when that lands.
 */
function TimerConsoleBody() {
  return (
    <TimerProvider>
      <div className={PANEL_HEADER_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>Timer</h2>
        <TimerPhaseChip />
      </div>
      <div className="grid lg:grid-cols-5">
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-8 lg:col-span-3">
          <TimerInstrument />
          <ProgressiveSection
            queryKeys={[trpc.stats.summary.queryKey()]}
            fallback={
              <SectionPlaceholder name="focus-chart" className="w-full max-w-sm">
                <FocusChartPlaceholder />
              </SectionPlaceholder>
            }
          >
            <FocusChart />
          </ProgressiveSection>
        </div>
        <div className="flex min-w-0 flex-col gap-5 border-t border-border/40 px-5 py-5 lg:col-span-2 lg:border-t-0 lg:border-l">
          <div className="space-y-2.5">
            <TimerTransport />
            <NowTask />
          </div>
          <TimerSettings />
          <ObsSources />
        </div>
      </div>
    </TimerProvider>
  );
}

/**
 * "Now: <task>" under the transport: the owner's own active task, or nothing. Reads `task.list`
 * and `user.me` from the cache the page's batch filled; the observer has no refetchInterval
 * (the board owns the poll), and `select` re-renders only this line, only when the text changes.
 */
function NowTask() {
  const me = useQuery(trpc.user.me.queryOptions());
  const ownerKey = ownerAuthorKey(me.data);
  const { data: text } = useQuery({
    ...trpc.task.list.queryOptions(),
    select: (list) => ownerActiveTask(list.tasks, ownerKey)?.text ?? null,
  });
  if (!text) return null;
  return (
    <p className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="console-label shrink-0">Now</span>
      <span className="sr-only">:</span>
      <span className="min-w-0 truncate" title={text}>
        {text}
      </span>
    </p>
  );
}

/** Task board (needs `task.list` + `user.me`, which pins the streamer's own group first). */
function TaskBoard() {
  const me = useQuery(trpc.user.me.queryOptions());
  return <TaskManager userTwitchId={ownerAuthorKey(me.data)} />;
}

/**
 * Dashboard home: the frame plus one `ProgressiveSection` per data-backed section. `session`
 * comes from the server page; the sections read the streamed queries.
 */
export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const meKey = trpc.user.me.queryKey();
  const timerKey = trpc.timer.get.queryKey();
  // Stats are never polled: they refetch when the timer/task polls see a change.
  useStatsRefresh();

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

      <ProgressiveSection
        queryKeys={[trpc.stats.summary.queryKey()]}
        fallback={
          <SectionPlaceholder name="stats">
            <StatTilesPlaceholder />
          </SectionPlaceholder>
        }
      >
        <StatTiles />
      </ProgressiveSection>

      <div className="grid gap-6">
        {/* Hero instrument: the timer console. Its heading row carries the live phase chip,
            so it lives inside the section (the placeholder repeats its shape). */}
        <section className="panel-hero">
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

        {/* Task board, full width: the overlay URLs live in the timer console's OBS sources. */}
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
