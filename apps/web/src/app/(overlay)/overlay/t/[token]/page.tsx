"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { defaultTimerStyles } from "@/lib/theme-presets";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import { OVERLAY_POLL_MS } from "@/lib/poll-intervals";
import { type TimerState, resolvePhaseDuration } from "@/lib/timer-utils";
import { AutoScale } from "@/components/auto-scale";
import { FontGate } from "@/components/font-gate";
import { TimerDisplay } from "@/components/timer-display";
import { publicTrpc } from "@/utils/trpc";

const defaultTimerState: TimerState = {
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
    queryFn: () => publicTrpc.overlay.getTimerState.mutate({ token }),
    enabled: Boolean(token),
    // The countdown ticks locally inside TimerDisplay from targetEndTime; the
    // poll only picks up phase changes and style edits.
    refetchInterval: OVERLAY_POLL_MS,
    refetchIntervalInBackground: true,
    // Unattended OBS source: a failed poll must never toast onto the stream.
    meta: { silent: true },
  });

  if (isPending) return null;

  // The wire payload carries targetEndTime as a serialized string.
  const timerState = (data?.timerState as TimerState | null | undefined) ?? defaultTimerState;
  const timerStyles = data?.timerStyles ?? defaultTimerStyles;
  const timerConfig = data?.timerConfig;

  const displayConfig = {
    ...timerStyles,
    labels: timerConfig?.labels ?? DEFAULT_PHASE_LABELS,
    showHours: timerConfig?.showHours ?? false,
  };

  // Ring progress measures remaining against the streamer's configured phase
  // length (paused phases measure against the phase they froze in). Without a
  // config row TimerDisplay falls back to its built-in defaults. Idle has no
  // phase of its own — show the work length so the setup preview reads full.
  const totalDuration = timerConfig
    ? (resolvePhaseDuration(timerState.status, timerState.pausedFromStatus, timerConfig) ??
      (timerState.status === "idle" ? timerConfig.workDuration : undefined))
    : undefined;

  return (
    <FontGate className="h-screen w-screen bg-transparent">
      <AutoScale>
        <TimerDisplay config={displayConfig} state={timerState} totalDuration={totalDuration} />
      </AutoScale>
    </FontGate>
  );
}
