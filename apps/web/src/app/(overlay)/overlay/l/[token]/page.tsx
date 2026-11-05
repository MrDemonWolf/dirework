"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";

import { isOverlayPreview, taskOverlayView } from "@/lib/overlay-view";
import { OVERLAY_POLL_QUERY_OPTS } from "@/lib/poll-intervals";
import { useReloadAfterDeploy } from "@/lib/use-reload-after-deploy";
import { FontGate } from "@/components/font-gate";
import { TaskListDisplay } from "@/components/task-list-display";
import { publicTrpc } from "@/utils/public-trpc";

export default function TaskListOverlayPage() {
  const { token } = useParams<{ token: string }>();
  // The dashboard's live preview loads this page with `?preview=1`; OBS loads the plain URL.
  const preview = isOverlayPreview(useSearchParams());

  // Polls the api worker directly (token auth, no cookies) — see timer
  // overlay for rationale. Last successful payload is kept across failed
  // refetches so the OBS source never blanks on a transient error.
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["overlay", "taskList", token],
    queryFn: () => publicTrpc.overlay.getTaskList.mutate({ token }),
    enabled: Boolean(token),
    // An OBS source polls in the background too; the preview stops while its
    // dashboard tab is hidden.
    ...OVERLAY_POLL_QUERY_OPTS,
    refetchIntervalInBackground: !preview,
  });

  // Nothing until the first payload lands, and nothing for an invalid or reset
  // token (null) — a stale URL goes blank instead of showing "No tasks yet".
  const view = taskOverlayView(data);
  // A source left open across a deploy reloads once the new build is live (the list has no
  // moment safer than another; it blanks for about one poll).
  useReloadAfterDeploy(dataUpdatedAt, true);
  if (!view) return null;

  const tasks = view.tasks as {
    id: string;
    authorTwitchId: string;
    authorDisplayName: string;
    authorColor: string | null;
    text: string;
    status: string;
  }[];

  return (
    <FontGate className="h-screen w-screen bg-transparent p-4">
      <TaskListDisplay config={view.config} tasks={tasks} counts={view.counts} />
    </FontGate>
  );
}
