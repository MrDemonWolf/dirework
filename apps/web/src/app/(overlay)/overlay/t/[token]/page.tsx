"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { defaultTimerStyles } from "@/lib/theme-presets";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import { resolvePhaseDuration } from "@/lib/timer-utils";
import { AutoScale } from "@/components/auto-scale";
import { TimerDisplay } from "@/components/timer-display";
import { publicTrpc } from "@/utils/trpc";

/**
 * Overlay polling interval. The countdown itself ticks locally inside
 * TimerDisplay (computed from targetEndTime vs Date.now()); polling only
 * picks up phase changes and style edits.
 *
 * 3s (not less): the countdown ticks locally from targetEndTime, so the poll
 * only needs to catch state changes (start/pause/phase/style). Larger interval
 * = far fewer Worker requests for OBS sources left running (Cloudflare free tier).
 */
const POLL_INTERVAL_MS = 3000;

const defaultTimerState = {
  status: "idle",
  targetEndTime: null,
  pausedWithRemaining: null,
  pausedFromStatus: null,
  currentCycle: 1,
  totalCycles: 4,
};

export default function TimerOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // Polls the api worker directly (token auth, no cookies) — no same-origin
  // proxy hop for high-frequency overlay traffic. React Query keeps the last
  // successful payload across failed refetches, so transient errors don't
  // blank the OBS source.
  const { data, isPending } = useQuery({
    queryKey: ["overlay", "timerState", token],
    queryFn: () => publicTrpc.overlay.getTimerState.query({ token }),
    enabled: Boolean(token),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  if (isPending) return null;

  const timerState = data?.timerState ?? defaultTimerState;
  const timerStyles = data?.timerStyles ?? defaultTimerStyles;
  const timerConfig = data?.timerConfig;

  // TimerDisplay indexes labels by runtime status string — widen the closed
  // PhaseLabelsConfig interface to a Record via spread.
  const labels: Record<string, string> = {
    ...(timerConfig?.labels ?? DEFAULT_PHASE_LABELS),
  };

  const displayConfig = {
    ...timerStyles,
    labels,
    showHours: timerConfig?.showHours ?? false,
  };

  // Ring progress measures remaining against the streamer's configured phase
  // length (paused phases measure against the phase they froze in). Without a
  // config row TimerDisplay falls back to its built-in defaults. Idle has no
  // phase of its own — show the work length so the setup preview reads full.
  const totalDuration = timerConfig
    ? (resolvePhaseDuration(timerState.status, timerState.pausedFromStatus, timerConfig) ??
      (timerState.status === "idle" ? timerConfig.workDuration : undefined) ??
      undefined)
    : undefined;

  return (
    <div className="h-screen w-screen bg-transparent">
      <AutoScale>
        <TimerDisplay
          config={displayConfig}
          state={
            timerState as {
              status: string;
              targetEndTime: string | null;
              pausedWithRemaining: number | null;
              pausedFromStatus: string | null;
              currentCycle: number;
              totalCycles: number;
            }
          }
          totalDuration={totalDuration}
        />
      </AutoScale>
    </div>
  );
}
