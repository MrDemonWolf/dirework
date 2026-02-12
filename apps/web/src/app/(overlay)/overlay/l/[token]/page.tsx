"use client";

import { useRef } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useParams } from "next/navigation";

import { defaultTaskStyles } from "@/lib/theme-presets";
import { TaskListDisplay } from "@/components/task-list-display";
import { trpc } from "@/utils/trpc";

export default function TaskListOverlayPage() {
  const { token } = useParams<{ token: string }>();

  const { data, status } = useSubscription({
    ...trpc.overlay.onTaskList.subscriptionOptions({ token }),
    enabled: true,
  });

  const lastKnownDataRef = useRef(data);
  if (data) lastKnownDataRef.current = data;

  const current = data ?? lastKnownDataRef.current;
  if (!current && (status === "connecting" || status === "idle")) return null;

  const rawTasks = current?.tasks ?? [];
  const tasks = rawTasks as {
    id: string;
    authorTwitchId: string;
    authorDisplayName: string;
    authorColor: string | null;
    text: string;
    status: string;
  }[];

  const displayConfig = current?.taskStyles ?? defaultTaskStyles;

  return (
    <div className="h-screen w-screen bg-transparent p-4">
      <TaskListDisplay config={displayConfig} tasks={tasks} />
    </div>
  );
}
