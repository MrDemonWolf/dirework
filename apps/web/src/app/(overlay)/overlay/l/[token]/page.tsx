"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { defaultTaskStyles } from "@/lib/theme-presets";
import { TaskListDisplay } from "@/components/task-list-display";
import { publicTrpc } from "@/utils/trpc";

/** Overlay polling interval — task lists only change on chat/dashboard edits. */
const POLL_INTERVAL_MS = 2000;

export default function TaskListOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // Polls the api worker directly (token auth, no cookies) — see timer
  // overlay for rationale. Last successful payload is kept across failed
  // refetches so the OBS source never blanks on a transient error.
  const { data, isPending } = useQuery({
    queryKey: ["overlay", "taskList", token],
    queryFn: () => publicTrpc.overlay.getTaskList.query({ token }),
    enabled: Boolean(token),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
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
    <div className="h-screen w-screen bg-transparent p-4">
      <TaskListDisplay config={displayConfig} tasks={tasks} />
    </div>
  );
}
