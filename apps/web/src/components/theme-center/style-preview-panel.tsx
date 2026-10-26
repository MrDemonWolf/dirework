"use client";

// Theme Center live preview: renders the real overlay components (TimerDisplay,
// TaskListDisplay) with the owner's unsaved styles over the shared demo session
// (DEMO_SESSION, via lib/preview-session), placed on a 1920 × 1080 stream canvas at the
// size and spot they take on stream. Entirely client-side — the preview never polls or
// calls the API.

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, Pause, Play, ZoomIn } from "lucide-react";

import type { TimerStylesConfig, TaskStylesConfig, PhaseLabelsConfig } from "@/lib/config-types";
import {
  PREVIEW_BACKDROPS as backdrops,
  type PreviewBackdrop as Backdrop,
  PREVIEW_CYCLE,
  PREVIEW_PHASE_MS,
  PREVIEW_REMAINING_MS,
  PREVIEW_TASKS,
  STREAM_CANVAS,
  TASKS_SOURCE,
  previewSceneLayout,
  timerSourceSize,
  type SceneSource,
  type Size,
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
            "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11 pointer-coarse:px-4",
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
      className="flex min-w-0 items-center gap-1.5 border-0 p-0 pointer-coarse:gap-2"
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
            "size-6 cursor-pointer overflow-hidden rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:size-11",
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
 * One browser source at its stream size. On the scene it sits at its canvas spot, and the
 * selected one wears an outline outside its box (as OBS marks the selected source), so
 * nothing is drawn over the overlay itself.
 */
function Source({
  size,
  at,
  selected,
  children,
}: {
  size: Size;
  at?: SceneSource;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        at ? "absolute" : "relative",
        selected && "outline-6 outline-offset-6 outline-link",
      )}
      style={{ width: size.width, height: size.height, left: at?.x, top: at?.y }}
    >
      {children}
    </div>
  );
}

/**
 * The page's hero instrument: a 16:9 stream canvas (1920 × 1080) with both overlays at
 * their true size and a usual spot, scaled down as a whole, so the owner sees what viewers
 * see. Timer / Tasks picks the source the toolbar talks about; Close-up zooms to that
 * source alone, for reading small type. Backdrops: dark stays the default since streamers
 * design against dark scenes; light, bright and checkerboard reveal how a transparent
 * overlay really composites. The header chip says whether the preview shows unsaved edits.
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
  const [closeUp, setCloseUp] = useState(false);
  // Below lg only (see the Show/Hide button); starts collapsed, so the editors lead.
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();

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

  const timerSize = timerSourceSize(timerStyles.dimensions);
  const layout = previewSceneLayout(timerSize);
  const selectedSize = target === "timer" ? timerSize : TASKS_SOURCE;
  // The canvas takes the scene's 16:9, or the selected source's shape in a close-up.
  const frame = closeUp ? selectedSize : STREAM_CANVAS;

  // Each overlay page's own markup: the timer AutoScaled to fill its source, the task list
  // filling its source inside a 16px pad.
  const timer = (
    <AutoScale>
      <TimerDisplay
        config={timerPreviewConfig(timerStyles, phaseLabels, showHours)}
        state={timerState}
        totalDuration={PREVIEW_PHASE_MS}
      />
    </AutoScale>
  );
  const tasks = (
    <div className="size-full p-4">
      <TaskListDisplay config={taskStyles} tasks={PREVIEW_TASKS} />
    </div>
  );

  return (
    <section aria-labelledby="style-preview-title" className="panel-hero">
      <div className="flex flex-col gap-3 p-3 lg:gap-4 lg:p-5">
        <div className="flex items-center gap-2">
          <ConsoleRule as="h2" id="style-preview-title" label="Preview" className="min-w-0 flex-1">
            {/* Every edit lands here before it reaches OBS; the chip says which one you see.
                Below lg the bar also holds Show/Hide, so the chip says it in one word there
                (the other chip is display: none, so a screen reader hears one). */}
            <StatusChip
              tone={dirty ? "warn" : "live"}
              size="sm"
              label={dirty ? "Previewing unsaved changes" : "Matches the saved theme"}
              className="max-lg:hidden"
            />
            <StatusChip
              tone={dirty ? "warn" : "live"}
              size="sm"
              label={dirty ? "Unsaved" : "Saved"}
              className="lg:hidden"
            />
          </ConsoleRule>
          {/* Below lg the panel is a sticky bar above the editors: collapsed it keeps the
              status in view without covering the fields, expanded it shows the canvas, which
              stays put while the owner scrolls and edits. The rail is always open. */}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1 pointer-coarse:min-h-11 lg:hidden"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Hide" : "Show"}
            <span className="sr-only"> preview</span>
            <ChevronDown
              aria-hidden
              className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            />
          </Button>
        </div>

        <div
          id={bodyId}
          className={cn("flex-col gap-3 lg:flex lg:gap-4", expanded ? "flex" : "hidden")}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TargetToggle value={target} onChange={setTarget} />
            <BackdropToggle value={backdrop} onChange={setBackdrop} />
          </div>

          {/* The canvas holds the overlays only; every control sits in the rows around it.
              A close-up is capped below lg so the expanded sticky bar leaves the editors
              room (the 16:9 scene is short enough at full width). */}
          <figure className={cn("m-0 w-full", closeUp && "mx-auto max-w-64 lg:max-w-none")}>
            <div
              className={cn(CANVAS, closeUp && "p-4", canvasClass)}
              style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
            >
              <AutoScale margin={1}>
                {closeUp ? (
                  <Source size={selectedSize}>{target === "timer" ? timer : tasks}</Source>
                ) : (
                  <div
                    className="relative"
                    style={{ width: STREAM_CANVAS.width, height: STREAM_CANVAS.height }}
                  >
                    <Source size={TASKS_SOURCE} at={layout.tasks} selected={target === "tasks"}>
                      {tasks}
                    </Source>
                    <Source size={timerSize} at={layout.timer} selected={target === "timer"}>
                      {timer}
                    </Source>
                  </div>
                )}
              </AutoScale>
            </div>
            <figcaption className="sr-only">
              {closeUp
                ? `Close-up of the ${target === "timer" ? "timer" : "task list"} overlay.`
                : `The timer and task list overlays at their size and place on a ${STREAM_CANVAS.width} × ${STREAM_CANVAS.height} stream.`}
            </figcaption>
          </figure>

          <div className="flex flex-wrap items-center gap-2">
            {(target === "timer" || !closeUp) && (
              <Button
                variant="outline"
                size="xs"
                className="gap-1 pointer-coarse:min-h-11"
                aria-pressed={!!targetEndTime}
                onClick={togglePlay}
              >
                {targetEndTime ? <Pause className="size-3" /> : <Play className="size-3" />}
                {targetEndTime ? "Pause" : "Play"}
              </Button>
            )}
            {/* The selected source's size, and the canvas it sits on. */}
            <span className="console-label tabular-nums">
              {selectedSize.width} × {selectedSize.height}
              {!closeUp && ` in ${STREAM_CANVAS.height}p`}
            </span>
            <Button
              variant="outline"
              size="xs"
              className="ml-auto gap-1 pointer-coarse:min-h-11"
              aria-pressed={closeUp}
              onClick={() => setCloseUp((on) => !on)}
            >
              <ZoomIn className="size-3" aria-hidden />
              Close-up
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
