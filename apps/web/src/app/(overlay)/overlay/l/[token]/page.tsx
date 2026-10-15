"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { taskOverlayView } from "@/lib/overlay-view";
import { OVERLAY_POLL_MS } from "@/lib/poll-intervals";
import { FontGate } from "@/components/font-gate";
import { TaskListDisplay } from "@/components/task-list-display";
import { publicTrpc } from "@/utils/trpc";

export default function TaskListOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // Polls the api worker directly (token auth, no cookies) — see timer
  // overlay for rationale. Last successful payload is kept across failed
  // refetches so the OBS source never blanks on a transient error.
  const { data } = useQuery({
    queryKey: ["overlay", "taskList", token],
    queryFn: () => publicTrpc.overlay.getTaskList.mutate({ token }),
    enabled: Boolean(token),
    refetchInterval: OVERLAY_POLL_MS,
    refetchIntervalInBackground: true,
    // Unattended OBS source: a failed poll must never toast onto the stream.
    meta: { silent: true },
  });

  // Nothing until the first payload lands, and nothing for an invalid or reset
  // token (null) — a stale URL goes blank instead of showing "No tasks yet".
  const view = taskOverlayView(data);
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
