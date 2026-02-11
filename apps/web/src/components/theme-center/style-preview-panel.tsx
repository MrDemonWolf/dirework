"use client";

import type { TimerStylesConfig, TaskStylesConfig } from "@/lib/config-types";
import { TimerDisplay } from "@/components/timer-display";
import { TaskListDisplay } from "@/components/task-list-display";

const MOCK_DURATION = 25 * 60 * 1000; // 25 minutes

// Use pausedWithRemaining to avoid hydration mismatch from Date.now()
const mockTimerState = {
  status: "work",
  targetEndTime: null,
  pausedWithRemaining: 15 * 60 * 1000, // 15 minutes remaining
  currentCycle: 2,
  totalCycles: 4,
};

const mockTasks = [
  { id: "1", authorDisplayName: "StreamerWolf", authorColor: null, text: "Fix the auth flow for bot accounts", status: "pending" },
  { id: "2", authorDisplayName: "ViewerFox", authorColor: "#ff6b35", text: "Review the PR for overlay updates", status: "pending" },
  { id: "3", authorDisplayName: "CozyBear", authorColor: "#2dd4bf", text: "Write unit tests for timer", status: "done" },
];

function timerPreviewConfig(styles: TimerStylesConfig) {
  return {
    ...styles,
    labels: {
      idle: "Ready",
      starting: "Starting",
      work: "Focus",
      break: "Break",
      longBreak: "Long Break",
      paused: "Paused",
      finished: "Done",
    },
    showHours: false,
  };
}

export function StylePreviewPanel({
  timerStyles,
  taskStyles,
}: {
  timerStyles: TimerStylesConfig;
  taskStyles: TaskStylesConfig;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Timer Preview */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Timer Preview</p>
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/80 p-6">
          <TimerDisplay
            config={timerPreviewConfig(timerStyles)}
            state={mockTimerState}
            totalDuration={MOCK_DURATION}
          />
        </div>
      </div>

      {/* Task List Preview */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Task List Preview</p>
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/80 p-4">
          <div style={{ height: "300px" }}>
            <TaskListDisplay config={taskStyles} tasks={mockTasks} />
          </div>
        </div>
      </div>
    </div>
  );
}
