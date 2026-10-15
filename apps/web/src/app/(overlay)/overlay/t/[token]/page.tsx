"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { timerOverlayView } from "@/lib/overlay-view";
import { OVERLAY_POLL_MS } from "@/lib/poll-intervals";
import { AutoScale } from "@/components/auto-scale";
import { FontGate } from "@/components/font-gate";
import { TimerDisplay } from "@/components/timer-display";
import { publicTrpc } from "@/utils/trpc";

export default function TimerOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // Polls the api worker directly (token auth, no cookies) — no same-origin
  // proxy hop for high-frequency overlay traffic. React Query keeps the last
  // successful payload across failed refetches, so transient errors don't
  // blank the OBS source.
  const { data } = useQuery({
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

  // Nothing until the first payload lands, and nothing for an invalid or reset
  // token (null) — a stale URL goes blank instead of showing a fake 00:00.
  const view = timerOverlayView(data);
  if (!view) return null;

  return (
    <FontGate className="h-screen w-screen bg-transparent">
      <AutoScale>
        <TimerDisplay config={view.config} state={view.state} totalDuration={view.totalDuration} />
      </AutoScale>
    </FontGate>
  );
}
