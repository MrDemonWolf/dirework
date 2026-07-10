"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import type { TimerStylesConfig, TaskStylesConfig, PhaseLabelsConfig } from "@/lib/config-types";
import { cn } from "@/lib/utils";
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

function timerPreviewConfig(styles: TimerStylesConfig, labels: PhaseLabelsConfig) {
  return {
    ...styles,
    labels: { ...labels } as Record<string, string>,
    showHours: false,
  };
}

type Backdrop = "dark" | "light" | "checker";

// Literal backdrop colors are sanctioned here — they simulate external OBS
// scene content behind the overlay, not app chrome.
const backdrops: { id: Backdrop; label: string; className: string; swatch: string }[] = [
  { id: "dark", label: "Dark backdrop", className: "bg-[oklch(0.14_0.035_262)] bg-grain", swatch: "bg-[oklch(0.14_0.035_262)]" },
  { id: "light", label: "Light backdrop", className: "bg-zinc-100 bg-grain", swatch: "bg-zinc-100" },
  { id: "checker", label: "Checkerboard backdrop", className: "bg-checker", swatch: "bg-checker" },
];

function BackdropToggle({
  value,
  onChange,
}: {
  value: Backdrop;
  onChange: (v: Backdrop) => void;
}) {
  // Plain aria-pressed toggles — the old role="radiogroup" promised
  // arrow-key navigation it never implemented (worse than no semantics).
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Preview backdrop">
      {backdrops.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-pressed={value === b.id}
          aria-label={b.label}
          title={b.label}
          onClick={() => onChange(b.id)}
          className={cn(
            "size-6 cursor-pointer overflow-hidden rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            b.swatch,
            value === b.id
              ? "border-primary ring-2 ring-ring"
              : "border-border hover:border-primary/50",
          )}
        />
      ))}
    </div>
  );
}

/**
 * OBS-like preview canvas — the page's hero instrument. Backdrop is
 * switchable (audit L16): dark stays the default since streamers design
 * against dark scenes, but light and checkerboard reveal how a transparent
 * overlay really composites.
 */
export function StylePreviewPanel({
  timerStyles,
  taskStyles,
  phaseLabels,
}: {
  timerStyles: TimerStylesConfig;
  taskStyles: TaskStylesConfig;
  phaseLabels: PhaseLabelsConfig;
}) {
  const [targetEndTime, setTargetEndTime] = useState<string | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState(DEFAULT_PAUSED_REMAINING);
  const [backdrop, setBackdrop] = useState<Backdrop>("dark");

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
    : { status: "paused", targetEndTime: null, pausedWithRemaining: pausedRemaining, currentCycle: 2, totalCycles: 4 };

  const canvasClass = backdrops.find((b) => b.id === backdrop)!.className;

  return (
    <div className="panel-hero">
      <div className="flex flex-col gap-4 px-5 py-5">
        {/* Canvas controls */}
        <div className="flex items-center gap-3">
          <div className="console-rule min-w-0 flex-1">
            <span className="console-label">Preview canvas</span>
          </div>
          <BackdropToggle value={backdrop} onChange={setBackdrop} />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            aria-pressed={!!targetEndTime}
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
                Play
              </>
            )}
          </Button>
        </div>

        {/* Timer Preview */}
        <div
          className={cn(
            "panel-inset relative flex items-center justify-center overflow-hidden p-6",
            canvasClass,
          )}
        >
          <TimerDisplay
            config={timerPreviewConfig(timerStyles, phaseLabels)}
            state={timerState}
            totalDuration={MOCK_DURATION}
          />
          <span className="console-label absolute right-2 bottom-1.5">
            {timerStyles.dimensions.width} × {timerStyles.dimensions.height}
          </span>
        </div>

        {/* Task List Preview */}
        <div className="console-rule">
          <span className="console-label">Task list</span>
        </div>
        <div
          className={cn(
            "panel-inset relative overflow-hidden p-4",
            canvasClass,
          )}
        >
          <div style={{ height: "300px" }}>
            <TaskListDisplay config={taskStyles} tasks={mockTasks} />
          </div>
          <span className="console-label absolute right-2 bottom-1.5">300px</span>
        </div>
      </div>
    </div>
  );
}
