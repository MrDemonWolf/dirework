"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { deepMerge } from "@/lib/deep-merge";
import { defaultTaskStyles } from "@/lib/theme-presets";
import { TaskListDisplay } from "@/components/task-list-display";
import { trpc } from "@/utils/trpc";

const POLL_INTERVAL = 2000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export default function TaskListOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = useQuery({
    ...(trpc.overlay.getTaskList.queryOptions({ token }) as any),
    refetchInterval: POLL_INTERVAL,
  }) as {
    isLoading: boolean;
    data: { tasks: AnyRecord[]; config: AnyRecord | null } | null | undefined;
  };

  if (query.isLoading) return null;

  const rawTasks = query.data?.tasks ?? [];
  const tasks = rawTasks as {
    id: string;
    authorDisplayName: string;
    authorColor: string | null;
    text: string;
    status: string;
  }[];

  const savedStyles = ((query.data?.config?.taskStyles ?? {}) as AnyRecord);
  const displayConfig = deepMerge(defaultTaskStyles, savedStyles);

  return (
    <div className="h-screen w-screen bg-transparent p-4">
      <TaskListDisplay config={displayConfig as any} tasks={tasks} />
    </div>
  );
}
