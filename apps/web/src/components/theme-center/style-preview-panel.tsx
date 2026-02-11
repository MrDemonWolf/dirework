"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import type { TimerStylesConfig, TaskStylesConfig } from "@/lib/config-types";
import { Button } from "@/components/ui/button";
import { TimerDisplay } from "@/components/timer-display";
import { TaskListDisplay } from "@/components/task-list-display";

const MOCK_DURATION = 25 * 60 * 1000; // 25 minutes

// Use pausedWithRemaining to avoid hydration mismatch from Date.now()
const mockTimerStatePaused = {
  status: "work",
  targetEndTime: null,
  pausedWithRemaining: 15 * 60 * 1000, // 15 minutes remaining
  currentCycle: 2,
  totalCycles: 4,
};

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
  const [timerRunning, setTimerRunning] = useState(false);
  const [remaining, setRemaining] = useState(15 * 60 * 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Start/stop the countdown simulation
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 0) {
            // Reset to simulate looping
            return MOCK_DURATION;
          }
          return prev - 100;
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerRunning]);

  const timerState = timerRunning
    ? {
        status: "work",
        targetEndTime: null,
        pausedWithRemaining: remaining,
        currentCycle: 2,
        totalCycles: 4,
      }
    : mockTimerStatePaused;

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
              if (!timerRunning) setRemaining(15 * 60 * 1000);
              setTimerRunning(!timerRunning);
            }}
          >
            {timerRunning ? (
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
