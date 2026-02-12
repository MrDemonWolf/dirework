"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import type { TimerStylesConfig, TaskStylesConfig } from "@/lib/config-types";
import { Button } from "@/components/ui/button";
import { TimerDisplay } from "@/components/timer-display";
import { TaskListDisplay } from "@/components/task-list-display";

const MOCK_DURATION = 25 * 60 * 1000; // 25 minutes

const DEFAULT_PAUSED_REMAINING = 15 * 60 * 1000; // 15 minutes

const mockTasks = [
  { id: "1", authorTwitchId: "1001", authorDisplayName: "StreamerWolf", authorColor: null, text: "Fix the auth flow for bot accounts", status: "pending" },
  { id: "2", authorTwitchId: "1002", authorDisplayName: "ViewerFox", authorColor: "#ff6b35", text: "Review the PR for overlay updates", status: "pending" },
  { id: "3", authorTwitchId: "1002", authorDisplayName: "ViewerFox", authorColor: "#ff6b35", text: "Update the README docs", status: "pending" },
  { id: "4", authorTwitchId: "1003", authorDisplayName: "CozyBear", authorColor: "#2dd4bf", text: "Write unit tests for timer", status: "done" },
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
  const [targetEndTime, setTargetEndTime] = useState<string | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState(DEFAULT_PAUSED_REMAINING);

  // Auto-reset (loop) when countdown reaches 0
  useEffect(() => {
    if (!targetEndTime) return;
    const check = setInterval(() => {
      if (new Date(targetEndTime).getTime() <= Date.now()) {
        setTargetEndTime(new Date(Date.now() + MOCK_DURATION).toISOString());
      }
    }, 1000);
    return () => clearInterval(check);
  }, [targetEndTime]);

  const timerState = targetEndTime
    ? { status: "work", targetEndTime, pausedWithRemaining: null, currentCycle: 2, totalCycles: 4 }
    : { status: "work", targetEndTime: null, pausedWithRemaining: pausedRemaining, currentCycle: 2, totalCycles: 4 };

  return (
    <div className="flex flex-col gap-6">
      {/* Timer Preview */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Timer Preview</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => {
              if (targetEndTime) {
                // Pause: freeze remaining time
                const msLeft = Math.max(0, new Date(targetEndTime).getTime() - Date.now());
                setPausedRemaining(msLeft);
                setTargetEndTime(null);
              } else {
                // Start/resume: set a future end time
                const msLeft = pausedRemaining ?? MOCK_DURATION;
                setTargetEndTime(new Date(Date.now() + msLeft).toISOString());
              }
            }}
          >
            {targetEndTime ? (
              <>
                <Pause className="size-3" />
                Pause
              </>
            ) : (
              <>
                <Play className="size-3" />
                Animate
              </>
            )}
          </Button>
        </div>
        <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/80 p-6">
          <TimerDisplay
            config={timerPreviewConfig(timerStyles)}
            state={timerState}
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
