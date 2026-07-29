"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ConsoleRule } from "@/components/console-rule";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Pause, Play, SkipForward, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/status-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type TimerState, formatClock, resolvePhaseDuration } from "@/lib/timer-utils";
import { useTimerCountdown } from "@/lib/use-timer-countdown";
import { TIMER_TONES, TIMER_PHASE_COLOR, toTimerStatus } from "@/lib/status-tones";
import { DEFAULT_PHASE_LABELS, TIMER_CONFIG_DEFAULTS } from "@/lib/config-types";
import { trpc } from "@/utils/trpc";

function msToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

function minutesToMs(min: number): number {
  return min * 60000;
}

const DEFAULT_LABELS: Record<string, string> = { ...DEFAULT_PHASE_LABELS };

/**
 * Hardware-module cycle indicator: filled dots for completed pomos, a ringed
 * dot for the current one, hollow dots ahead. Falls back to a mono counter
 * when the run is too long to read as dots.
 */
function CycleDots({ current, total }: { current: number; total: number }) {
  if (total > 10) {
    return (
      <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground">
        <span className="font-semibold">{String(Math.min(current, total)).padStart(2, "0")}</span>/
        {String(total).padStart(2, "0")}
      </p>
    );
  }
  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={`Pomodoro ${Math.min(current, total)} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const cycleNum = i + 1;
        const isDone = cycleNum < current;
        const isCurrent = cycleNum === current;
        return (
          <span
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              isDone && "bg-primary",
              isCurrent && "bg-primary ring-2 ring-primary/30",
              !isDone && !isCurrent && "border border-muted-foreground/40 bg-transparent",
            )}
          />
        );
      })}
    </div>
  );
}

// --- Context ---

interface TimerContextValue {
  cycles: number;
  setCycles: (v: number) => void;
  workMin: number;
  setWorkMin: (v: number) => void;
  breakMin: number;
  setBreakMin: (v: number) => void;
  longBreakMin: number;
  setLongBreakMin: (v: number) => void;
  longBreakInterval: number;
  setLongBreakInterval: (v: number) => void;
  saveConfig: (overrides: Partial<typeof TIMER_CONFIG_DEFAULTS>) => void;
  status: string;
  isIdle: boolean;
  isPaused: boolean;
  displayTime: string;
  progressPct: number;
  state: TimerState | null;
  configLabels: Record<string, string>;
  start: { mutate: (args: { totalCycles: number }) => void; isPending: boolean };
  pause: { mutate: () => void; isPending: boolean };
  resume: { mutate: () => void; isPending: boolean };
  skip: { mutate: () => void; isPending: boolean };
  reset: { mutate: () => void; isPending: boolean };
}

const TimerContext = createContext<TimerContextValue | null>(null);

function useTimerContext() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimerContext must be used within TimerProvider");
  return ctx;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [cycles, setCycles] = useState(4);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [configLoaded, setConfigLoaded] = useState(false);

  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    // The countdown ticks locally from targetEndTime; the poll only syncs state
    // changes, so 2s is plenty. refetchIntervalInBackground is left false so the
    // control panel stops polling when its tab is hidden (Cloudflare free tier).
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
  });

  const config = useQuery(trpc.config.get.queryOptions());

  const configLabels: Record<string, string> = config.data?.timerConfig?.labels
    ? { ...config.data.timerConfig.labels }
    : DEFAULT_LABELS;

  const updateTimerConfig = useMutation({
    ...trpc.config.updateTimerConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
      // Blur-autosave needs visible confirmation — Styles/Bot get a Save bar,
      // this surface's only feedback is the toast.
      toast.success("Timer settings saved");
    },
    onError: (err) => {
      toast.error(`Couldn't save timer settings: ${err.message}`);
    },
  });

  useEffect(() => {
    if (!config.data || configLoaded) return;
    const tc = config.data.timerConfig;
    if (tc) {
      setWorkMin(msToMinutes(tc.workDuration));
      setBreakMin(msToMinutes(tc.breakDuration));
      setLongBreakMin(msToMinutes(tc.longBreakDuration));
      setLongBreakInterval(tc.longBreakInterval);
      setCycles(tc.defaultCycles);
    }
    setConfigLoaded(true);
  }, [config.data, configLoaded]);

  const saveConfig = (overrides: Partial<typeof TIMER_CONFIG_DEFAULTS>) => {
    // Skip no-op blurs — tabbing through the fields shouldn't fire saves.
    const tc = config.data?.timerConfig;
    if (
      tc &&
      Object.entries(overrides).every(([key, value]) => tc[key as keyof typeof tc] === value)
    ) {
      return;
    }
    updateTimerConfig.mutate(overrides);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.timer.get.queryKey() });
  };

  const mutationError = (action: string) => (err: { message: string }) => {
    toast.error(`Couldn't ${action} the timer: ${err.message}`);
  };

  const start = useMutation({
    ...trpc.timer.start.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("start"),
  });

  const pause = useMutation({
    ...trpc.timer.pause.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("pause"),
  });

  const resume = useMutation({
    ...trpc.timer.resume.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("resume"),
  });

  const skip = useMutation({
    ...trpc.timer.skip.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("skip"),
  });

  const reset = useMutation({
    ...trpc.timer.reset.mutationOptions(),
    onSuccess: invalidate,
    onError: mutationError("stop"),
  });

  const state = (timer.data as TimerState | undefined) ?? null;
  const status = state?.status ?? "idle";
  const isIdle = status === "idle" || status === "finished";
  const isPaused = status === "paused";

  const remaining = useTimerCountdown(state);

  const displayTime = isIdle
    ? formatClock(minutesToMs(workMin))
    : remaining !== null
      ? formatClock(remaining)
      : "--:--";

  // Progress through the current phase (0–100) for the instrument rail.
  // The phase's full length comes from the (locally edited) minutes; while
  // paused we measure against the phase the timer froze in — resolvePhaseDuration
  // owns that branch. Idle/finished return null and the rail reads empty.
  const totalDuration = resolvePhaseDuration(status, state?.pausedFromStatus, {
    workDuration: minutesToMs(workMin),
    breakDuration: minutesToMs(breakMin),
    longBreakDuration: minutesToMs(longBreakMin),
    startingDuration:
      config.data?.timerConfig?.startingDuration ?? TIMER_CONFIG_DEFAULTS.startingDuration,
  });
  const progressPct =
    !isIdle && totalDuration && remaining !== null
      ? Math.min(100, Math.max(0, 100 * (1 - remaining / totalDuration)))
      : 0;

  return (
    <TimerContext.Provider
      value={{
        cycles,
        setCycles,
        workMin,
        setWorkMin,
        breakMin,
        setBreakMin,
        longBreakMin,
        setLongBreakMin,
        longBreakInterval,
        setLongBreakInterval,
        saveConfig,
        status,
        isIdle,
        isPaused,
        displayTime,
        progressPct,
        state,
        configLabels,
        start,
        pause,
        resume,
        skip,
        reset,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

/**
 * The hero timer instrument — reads like a hardware timer: phase LED chip on
 * top, big glowing tabular digits, phase-progress rail, cycle dots, then the
 * transport controls.
 */
export function TimerInstrument() {
  const {
    cycles,
    workMin,
    breakMin,
    status,
    isIdle,
    isPaused,
    displayTime,
    progressPct,
    state,
    configLabels,
    start,
    pause,
    resume,
    skip,
    reset,
  } = useTimerContext();

  const timerStatus = toTimerStatus(status);
  const { tone, pulse } = TIMER_TONES[timerStatus];
  const phaseColor = TIMER_PHASE_COLOR[timerStatus];

  return (
    <div className="flex flex-col items-center gap-5">
      <StatusChip
        tone={tone}
        label={configLabels[status] ?? DEFAULT_LABELS[status] ?? status}
        pulse={pulse}
      />
      {/* Digits with a static phase-tinted ambient glow */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-1/2 -z-10 h-32 -translate-y-1/2"
          style={{
            background: `radial-gradient(closest-side, color-mix(in oklab, ${phaseColor} 14%, transparent), transparent)`,
          }}
        />
        <span className="font-heading text-7xl font-semibold tracking-tight tabular-nums lg:text-8xl">
          {displayTime}
        </span>
      </div>
      {/* Phase rail — progress through the current phase */}
      <div
        className={cn(
          "h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted",
          isIdle && "opacity-0",
        )}
        role="presentation"
      >
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${progressPct}%`, background: phaseColor }}
        />
      </div>
      {state && !isIdle ? (
        <CycleDots current={state.currentCycle} total={state.totalCycles} />
      ) : (
        <p className="font-mono text-xs tracking-wide text-muted-foreground">
          {cycles} {cycles === 1 ? "pomo" : "pomos"} &middot; {workMin}m focus &middot; {breakMin}m
          break
        </p>
      )}
      <div className="flex items-center gap-2">
        {isIdle ? (
          <Button
            size="lg"
            onClick={() => start.mutate({ totalCycles: cycles })}
            disabled={start.isPending}
            className="h-12 gap-2 px-8 text-base"
          >
            <Play className="size-4" />
            Start
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button
                size="lg"
                onClick={() => resume.mutate()}
                disabled={resume.isPending}
                className="h-12 gap-2 px-8 text-base"
              >
                <Play className="size-4" />
                Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => pause.mutate()}
                disabled={pause.isPending}
                className="h-12 gap-2 px-8 text-base"
              >
                <Pause className="size-4" />
                Pause
              </Button>
            )}
            {/* Segmented skip/stop cluster */}
            <div className="flex divide-x divide-border/50 overflow-hidden rounded-lg border border-border/50">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => skip.mutate()}
                      disabled={skip.isPending}
                      aria-label="Skip phase"
                      className="h-12 w-12 rounded-none border-0"
                    />
                  }
                >
                  <SkipForward className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Skip to the next phase</TooltipContent>
              </Tooltip>
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={reset.isPending}
                    aria-label="Stop timer"
                    className="h-12 w-12 rounded-none border-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Square className="size-4" />
                  </Button>
                }
                title="Stop the timer?"
                description="This ends the current run and resets the timer. Your progress is lost — chat will see the timer disappear from the overlay."
                confirmLabel="Stop timer"
                onConfirm={() => reset.mutate()}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function TimerSettings() {
  const {
    workMin,
    setWorkMin,
    breakMin,
    setBreakMin,
    longBreakMin,
    setLongBreakMin,
    longBreakInterval,
    setLongBreakInterval,
    cycles,
    setCycles,
    saveConfig,
    isIdle,
  } = useTimerContext();

  const fields = [
    {
      id: "timer-work-min",
      label: "Focus",
      unit: "min",
      tooltip: "Duration of each focus session in minutes",
      min: 1,
      max: 120,
      value: workMin,
      set: setWorkMin,
      save: (v: number) => saveConfig({ workDuration: minutesToMs(v) }),
    },
    {
      id: "timer-break-min",
      label: "Break",
      unit: "min",
      tooltip: "Duration of short breaks between focus sessions",
      min: 1,
      max: 60,
      value: breakMin,
      set: setBreakMin,
      save: (v: number) => saveConfig({ breakDuration: minutesToMs(v) }),
    },
    {
      id: "timer-long-break-min",
      label: "Long break",
      unit: "min",
      tooltip: "Duration of the long break in minutes",
      min: 1,
      max: 60,
      value: longBreakMin,
      set: setLongBreakMin,
      save: (v: number) => saveConfig({ longBreakDuration: minutesToMs(v) }),
    },
    {
      id: "timer-long-break-interval",
      label: "Every",
      unit: "pomos",
      tooltip: "Take a long break after this many focus sessions",
      min: 2,
      max: 20,
      value: longBreakInterval,
      set: setLongBreakInterval,
      save: (v: number) => saveConfig({ longBreakInterval: v }),
    },
    {
      id: "timer-pomos",
      label: "Pomos",
      unit: null,
      tooltip: "Total number of focus sessions (pomodoros) in this run",
      min: 1,
      max: 99,
      value: cycles,
      set: setCycles,
      save: (v: number) => saveConfig({ defaultCycles: v }),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ConsoleRule label="Settings" />
      {!isIdle && (
        <StatusChip size="sm" tone="idle" label="Locked while running" className="self-start" />
      )}
      {fields.map((field) => (
        <div key={field.id} className="grid grid-cols-[6.75rem_3rem_auto] items-center gap-2">
          {/* Help rides on aria-describedby (screen readers + keyboard get it,
              not just mouse hover); the tooltip stays as the pointer surface. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Label
                  htmlFor={field.id}
                  className="console-label inline-flex items-center gap-1 whitespace-nowrap"
                />
              }
            >
              {field.label}
              <Info className="size-3 text-muted-foreground" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{field.tooltip}</TooltipContent>
          </Tooltip>
          <Input
            id={field.id}
            type="number"
            min={field.min}
            max={field.max}
            value={field.value}
            aria-describedby={`${field.id}-help`}
            onChange={(e) => field.set(Number(e.target.value))}
            onBlur={() => {
              // Clamp instead of saving garbage: a cleared field otherwise
              // autosaves 0 and bounces off the server with a raw error.
              const clamped = Math.min(field.max, Math.max(field.min, field.value || field.min));
              if (clamped !== field.value) field.set(clamped);
              field.save(clamped);
            }}
            disabled={!isIdle}
            className="h-8 text-right font-mono tabular-nums"
          />
          <span id={`${field.id}-help`} className="sr-only">
            {field.tooltip}
          </span>
          {field.unit ? <span className="console-label">{field.unit}</span> : <span aria-hidden />}
        </div>
      ))}
    </div>
  );
}
