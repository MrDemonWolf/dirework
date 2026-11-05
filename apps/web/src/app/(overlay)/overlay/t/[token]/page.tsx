"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";

import { isOverlayPreview, isTimerCountingDown, timerOverlayView } from "@/lib/overlay-view";
import { OVERLAY_POLL_QUERY_OPTS } from "@/lib/poll-intervals";
import { useReloadAfterDeploy } from "@/lib/use-reload-after-deploy";
import { AutoScale } from "@/components/auto-scale";
import { FontGate } from "@/components/font-gate";
import { TimerDisplay } from "@/components/timer-display";
import { publicTrpc } from "@/utils/public-trpc";

export default function TimerOverlayPage() {
  const { token } = useParams<{ token: string }>();
  // The dashboard's live preview loads this page with `?preview=1`; OBS loads the plain URL.
  const preview = isOverlayPreview(useSearchParams());

  // Polls the api worker directly (token auth, no cookies) — no same-origin
  // proxy hop for high-frequency overlay traffic. React Query keeps the last
  // successful payload across failed refetches, so transient errors don't
  // blank the OBS source.
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["overlay", "timerState", token],
    queryFn: () => publicTrpc.overlay.getTimerState.mutate({ token }),
    enabled: Boolean(token),
    // The countdown ticks locally inside TimerDisplay from targetEndTime; the
    // poll only picks up phase changes and style edits. An OBS source polls in
    // the background too; the preview stops while its dashboard tab is hidden.
    ...OVERLAY_POLL_QUERY_OPTS,
    refetchIntervalInBackground: !preview,
  });

  // Nothing until the first payload lands, and nothing for an invalid or reset
  // token (null) — a stale URL goes blank instead of showing a fake 00:00.
  const view = timerOverlayView(data);
  // A source left open across a deploy reloads once the new build is live, never mid-countdown.
  useReloadAfterDeploy(dataUpdatedAt, !view || !isTimerCountingDown(view.state.status));
  if (!view) return null;

  return (
    <FontGate className="h-screen w-screen bg-transparent">
      <AutoScale>
        <TimerDisplay config={view.config} state={view.state} totalDuration={view.totalDuration} />
      </AutoScale>
    </FontGate>
  );
}
