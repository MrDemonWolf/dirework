"use client";

// Theme Center live preview: renders the real overlay components (TimerDisplay,
// TaskListDisplay) with the owner's unsaved styles over the shared demo session
// (DEMO_SESSION, via lib/preview-session). Entirely client-side — the preview never
// polls or calls the API.

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import type { TimerStylesConfig, TaskStylesConfig, PhaseLabelsConfig } from "@/lib/config-types";
import {
  PREVIEW_BACKDROPS as backdrops,
  type PreviewBackdrop as Backdrop,
  PREVIEW_CYCLE,
  PREVIEW_PHASE_MS,
  PREVIEW_REMAINING_MS,
  PREVIEW_TASKS,
} from "@/lib/preview-session";
import type { TimerState } from "@/lib/timer-utils";
import { cn } from "@/lib/utils";
import { AutoScale } from "@/components/auto-scale";
import { Button } from "@/components/ui/button";
import { ConsoleRule } from "@/components/console-rule";
import { StatusChip } from "@/components/status-chip";
import { TimerDisplay } from "@/components/timer-display";
import { TaskListDisplay } from "@/components/task-list-display";

// Same shape the timer overlay builds from its payload (styles + labels + showHours).
function timerPreviewConfig(
  styles: TimerStylesConfig,
  labels: PhaseLabelsConfig,
  showHours: boolean,
) {
  return {
    ...styles,
    labels,
    showHours,
  };
}

type PreviewTarget = "timer" | "tasks";

// The canvas frame. Not `.panel-inset`: its background ships inside an @supports block
// that comes later in the stylesheet, so it painted over the backdrop scenes.
const CANVAS = "relative overflow-hidden rounded-xl border border-border shadow-inner";

/** The recommended task-list browser source (the dashboard's size chip). */
const TASKS_SOURCE = { width: 700, height: 800 } as const;

const targets: { id: PreviewTarget; label: string; name: string }[] = [
  { id: "timer", label: "Timer", name: "Preview timer" },
  { id: "tasks", label: "Tasks", name: "Preview tasks" },
];

/** Which overlay the canvas shows: two aria-pressed buttons styled as a segmented control. */
function TargetToggle({
  value,
  onChange,
}: {
  value: PreviewTarget;
  onChange: (v: PreviewTarget) => void;
}) {
  return (
    <fieldset
      aria-label="Overlay to preview"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border-0 bg-muted p-0.5"
    >
      {targets.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          aria-label={t.name}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-10",
            value === t.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </fieldset>
  );
}

function BackdropToggle({ value, onChange }: { value: Backdrop; onChange: (v: Backdrop) => void }) {
  // Plain aria-pressed toggles — the old role="radiogroup" promised
  // arrow-key navigation it never implemented (worse than no semantics).
  return (
    <fieldset
      className="flex min-w-0 items-center gap-1.5 border-0 p-0"
      aria-label="Preview backdrop"
    >
      {backdrops.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-pressed={value === b.id}
          aria-label={b.label}
          title={b.label}
          onClick={() => onChange(b.id)}
          className={cn(
            "size-6 cursor-pointer overflow-hidden rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:size-9",
            b.swatch,
            value === b.id
              ? "border-primary ring-2 ring-ring"
              : "border-border hover:border-primary/50",
          )}
        />
      ))}
    </fieldset>
  );
}

/**
 * OBS-like preview canvas — the page's hero instrument. One overlay at a time (timer or
 * task list), over a switchable backdrop: dark stays the default since streamers design
 * against dark scenes; light, bright and checkerboard reveal how a transparent overlay
 * really composites. The header chip says whether the preview shows unsaved edits.
 */
export function StylePreviewPanel({
  timerStyles,
  taskStyles,
  phaseLabels,
  showHours = false,
  dirty = false,
}: {
  timerStyles: TimerStylesConfig;
  taskStyles: TaskStylesConfig;
  phaseLabels: PhaseLabelsConfig;
  /** The saved timer setting, so the preview clock is as wide as the OBS overlay's. */
  showHours?: boolean;
  /** The working styles differ from the saved ones (what the overlays show right now). */
  dirty?: boolean;
}) {
  const [targetEndTime, setTargetEndTime] = useState<string | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState(PREVIEW_REMAINING_MS);
  const [backdrop, setBackdrop] = useState<Backdrop>("dark");
  const [target, setTarget] = useState<PreviewTarget>("timer");

  // Loop the mock: once the countdown reaches 0, start a fresh focus phase. This is
  // a 1s check only — TimerDisplay's own countdown drives the digits and ring.
  useEffect(() => {
    if (!targetEndTime) return;
    const check = setInterval(() => {
      if (new Date(targetEndTime).getTime() <= Date.now()) {
        setTargetEndTime(new Date(Date.now() + PREVIEW_PHASE_MS).toISOString());
      }
    }, 1000);
    return () => clearInterval(check);
  }, [targetEndTime]);

  const cycle = { currentCycle: PREVIEW_CYCLE.current, totalCycles: PREVIEW_CYCLE.total };
  const timerState: TimerState = targetEndTime
    ? { status: "work", targetEndTime, pausedWithRemaining: null, ...cycle }
    : { status: "paused", targetEndTime: null, pausedWithRemaining: pausedRemaining, ...cycle };

  const canvasClass = backdrops.find((b) => b.id === backdrop)!.className;

  const togglePlay = () => {
    if (targetEndTime) {
      // Pause: freeze remaining time
      setPausedRemaining(Math.max(0, new Date(targetEndTime).getTime() - Date.now()));
      setTargetEndTime(null);
    } else {
      // Start/resume: set a future end time
      setTargetEndTime(new Date(Date.now() + pausedRemaining).toISOString());
    }
  };

  return (
    <section aria-labelledby="style-preview-title" className="panel-hero">
      <div className="flex flex-col gap-4 p-5">
        <ConsoleRule as="h2" id="style-preview-title" label="Preview" className="min-w-0">
          {/* Every edit lands here before it reaches OBS; the chip says which one you see. */}
          {dirty ? (
            <StatusChip tone="warn" size="sm" label="Previewing unsaved changes" />
          ) : (
            <StatusChip tone="live" size="sm" label="Matches the saved theme" />
          )}
        </ConsoleRule>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <TargetToggle value={target} onChange={setTarget} />
          <BackdropToggle value={backdrop} onChange={setBackdrop} />
        </div>

        {target === "timer" ? (
          <div className={cn(CANVAS, "aspect-square p-6", canvasClass)}>
            {/* Fit the fixed-size timer to the canvas, as AutoScale does in OBS. */}
            <AutoScale margin={0.92}>
              <TimerDisplay
                config={timerPreviewConfig(timerStyles, phaseLabels, showHours)}
                state={timerState}
                totalDuration={PREVIEW_PHASE_MS}
              />
            </AutoScale>
            <span className="console-label absolute right-2 bottom-1.5 rounded-sm bg-background/80 px-1">
              {timerStyles.dimensions.width} × {timerStyles.dimensions.height}
            </span>
            <Button
              variant="secondary"
              size="xs"
              className="absolute bottom-1.5 left-2 gap-1"
              aria-pressed={!!targetEndTime}
              onClick={togglePlay}
            >
              {targetEndTime ? <Pause className="size-3" /> : <Play className="size-3" />}
              {targetEndTime ? "Pause" : "Play"}
            </Button>
          </div>
        ) : (
          <div className={cn(CANVAS, "p-3", canvasClass)}>
            {/* Drawn at the recommended 700 × 800 OBS source size and scaled to fit, so
                type, padding and row heights keep the proportions the stream shows. */}
            <div
              className="w-full"
              style={{ aspectRatio: `${TASKS_SOURCE.width} / ${TASKS_SOURCE.height}` }}
            >
              <AutoScale margin={1}>
                <div style={{ width: TASKS_SOURCE.width, height: TASKS_SOURCE.height }}>
                  <TaskListDisplay config={taskStyles} tasks={PREVIEW_TASKS} />
                </div>
              </AutoScale>
            </div>
            <span className="console-label absolute right-2 bottom-1.5 rounded-sm bg-background/80 px-1">
              700 × 800
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
