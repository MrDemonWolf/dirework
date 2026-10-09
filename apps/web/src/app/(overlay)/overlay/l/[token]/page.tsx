"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { OVERLAY_POLL_MS } from "@/lib/poll-intervals";
import { defaultTaskStyles } from "@/lib/theme-presets";
import { FontGate } from "@/components/font-gate";
import { TaskListDisplay } from "@/components/task-list-display";
import { publicTrpc } from "@/utils/trpc";

export default function TaskListOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // Polls the api worker directly (token auth, no cookies) — see timer
  // overlay for rationale. Last successful payload is kept across failed
  // refetches so the OBS source never blanks on a transient error.
  const { data, isPending } = useQuery({
    queryKey: ["overlay", "taskList", token],
    queryFn: () => publicTrpc.overlay.getTaskList.mutate({ token }),
    enabled: Boolean(token),
    refetchInterval: OVERLAY_POLL_MS,
    refetchIntervalInBackground: true,
    // Unattended OBS source: a failed poll must never toast onto the stream.
    meta: { silent: true },
  });

  if (isPending) return null;

  const rawTasks = data?.tasks ?? [];
  const tasks = rawTasks as {
    id: string;
    authorTwitchId: string;
    authorDisplayName: string;
    authorColor: string | null;
    text: string;
    status: string;
  }[];

  const displayConfig = data?.taskStyles ?? defaultTaskStyles;

  return (
    <FontGate className="h-screen w-screen bg-transparent p-4">
      <TaskListDisplay config={displayConfig} tasks={tasks} counts={data?.counts} />
    </FontGate>
  );
}
