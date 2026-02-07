"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { TaskListDisplay } from "@/components/task-list-display";
import { trpc } from "@/utils/trpc";

const POLL_INTERVAL = 2000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Full Chat-Task-Tic-style defaults
const defaultTaskStyles = {
  display: {
    showDone: true,
    showCount: true,
    useCheckboxes: true,
    crossOnDone: true,
    numberOfLines: 2,
  },
  fonts: { header: "Fredoka One", body: "Nunito" },
  scroll: { pixelsPerSecond: 70, gapBetweenLoops: 100 },
  header: {
    height: "60px",
    background: { color: "#000000", opacity: 0.9 },
    border: { color: "#ffffff", width: "2px", radius: "10px" },
    fontSize: "30px",
    fontColor: "#ffffff",
    padding: "10px",
  },
  body: {
    background: { color: "#000000", opacity: 0 },
    border: { color: "#ffffff", width: "0px", radius: "0px" },
    padding: { vertical: "5px", horizontal: "5px" },
  },
  task: {
    background: { color: "#000000", opacity: 0.8 },
    border: { color: "#000000", width: "0px", radius: "5px" },
    fontSize: "25px",
    fontColor: "#ffffff",
    usernameColor: "#ffffff",
    padding: "10px",
    marginBottom: "5px",
    maxWidth: "100%",
    direction: "row",
  },
  taskDone: {
    background: { color: "#000000", opacity: 0.5 },
    fontColor: "#bbbbbb",
  },
  checkbox: {
    size: "20px",
    background: { color: "#000000", opacity: 0 },
    border: { color: "#ffffff", width: "1px", radius: "3px" },
    margin: { top: "6px", left: "2px", right: "5px" },
    tickChar: "\u2714",
    tickSize: "18px",
    tickColor: "#ffffff",
  },
  bullet: {
    char: "\u2022",
    size: "20px",
    color: "#ffffff",
    margin: { top: "0px", left: "2px", right: "5px" },
  },
};

function deepMerge(defaults: AnyRecord, overrides: AnyRecord): AnyRecord {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] &&
      typeof overrides[key] === "object" &&
      !Array.isArray(overrides[key]) &&
      defaults[key] &&
      typeof defaults[key] === "object"
    ) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

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
