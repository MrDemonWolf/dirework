"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Pause, Play, SkipForward, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip, type StatusTone } from "@/components/status-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/timer-utils";
import { DEFAULT_PHASE_LABELS } from "@/lib/config-types";
import { trpc } from "@/utils/trpc";

const DEFAULT_TIMER_VALUES = {
  workDuration: 25 * 60 * 1000,
  breakDuration: 5 * 60 * 1000,
  longBreakDuration: 15 * 60 * 1000,
  longBreakInterval: 4,
  defaultCycles: 4,
};

function msToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

function minutesToMs(min: number): number {
  return min * 60000;
}

const DEFAULT_LABELS: Record<string, string> = { ...DEFAULT_PHASE_LABELS };

function statusTone(status: string): StatusTone {
  switch (status) {
    case "work":
    case "starting":
      return "accent";
    case "break":
    case "longBreak":
      return "live";
    case "paused":
      return "warn";
    case "finished":
      return "live";
    default:
      return "idle";
  }
}

/**
 * Hardware-module cycle indicator: filled dots for completed pomos, a ringed
 * dot for the current one, hollow dots ahead. Falls back to a mono counter
 * when the run is too long to read as dots.
 */
function CycleDots({ current, total }: { current: number; total: number }) {
  if (total > 10) {
    return (
      <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground">
        {String(Math.min(current, total)).padStart(2, "0")}
        <span className="text-muted-foreground/50">/{String(total).padStart(2, "0")}</span>
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

interface TimerState {
  status: string;
  currentCycle: number;
  totalCycles: number;
  targetEndTime?: string | null;
  pausedWithRemaining?: number | null;
}

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
  saveConfig: (overrides: Partial<typeof DEFAULT_TIMER_VALUES>) => void;
  status: string;
  isIdle: boolean;
  isPaused: boolean;
  displayTime: string;
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [configLoaded, setConfigLoaded] = useState(false);
  const transitioningRef = useRef(false);

  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 1000,
  });

  const config = useQuery(trpc.config.get.queryOptions());

  const configLabels: Record<string, string> = config.data?.timerConfig?.labels
    ? { ...config.data.timerConfig.labels }
    : DEFAULT_LABELS;

  const updateTimerConfig = useMutation({
    ...trpc.config.updateTimerConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
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

  const saveConfig = (overrides: Partial<typeof DEFAULT_TIMER_VALUES>) => {
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

  const nextPhase = useMutation({
    ...trpc.timer.nextPhase.mutationOptions(),
    onSuccess: () => {
      transitioningRef.current = false;
      invalidate();
    },
    onError: () => {
      transitioningRef.current = false;
    },
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

  useEffect(() => {
    if (!state?.targetEndTime) {
      if (state?.pausedWithRemaining != null) {
        setRemaining(state.pausedWithRemaining);
      } else {
        setRemaining(null);
      }
      return;
    }

    const tick = () => {
      const ms = new Date(state.targetEndTime!).getTime() - Date.now();
      setRemaining(Math.max(0, ms));

      if (ms <= 0 && !transitioningRef.current) {
        transitioningRef.current = true;
        nextPhase.mutate();
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [state?.targetEndTime, state?.pausedWithRemaining]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    transitioningRef.current = false;
  }, [status]);

  const displayTime = isIdle
    ? formatClock(minutesToMs(workMin))
    : remaining !== null
      ? formatClock(remaining)
      : "--:--";

  return (
    <TimerContext.Provider
      value={{
        cycles, setCycles,
        workMin, setWorkMin,
        breakMin, setBreakMin,
        longBreakMin, setLongBreakMin,
        longBreakInterval, setLongBreakInterval,
        saveConfig,
        status, isIdle, isPaused,
        displayTime,
        state,
        configLabels,
        start, pause, resume, skip, reset,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

/**
 * The hero timer module — reads like a hardware timer: phase LED chip on top,
 * big tabular digits, cycle dots, then the transport controls.
 */
export function TimerDisplay() {
  const {
    cycles, workMin, breakMin,
    status, isIdle, isPaused, displayTime, state, configLabels,
    start, pause, resume, skip, reset,
  } = useTimerContext();

  return (
    <div className="flex flex-col items-center gap-4">
      <StatusChip
        tone={statusTone(status)}
        label={configLabels[status] ?? DEFAULT_LABELS[status] ?? status}
        pulse={status === "work" || status === "starting"}
      />
      <p className="font-heading text-7xl font-bold tabular-nums tracking-tight md:text-8xl">
        {displayTime}
      </p>
      {state && !isIdle ? (
        <CycleDots current={state.currentCycle} total={state.totalCycles} />
      ) : (
        <p className="font-mono text-xs tracking-wide text-muted-foreground">
          {cycles} {cycles === 1 ? "pomo" : "pomos"} &middot; {workMin}m work &middot; {breakMin}m break
        </p>
      )}
      <div className="flex items-center gap-2">
        {isIdle ? (
          <Button
            size="lg"
            onClick={() => start.mutate({ totalCycles: cycles })}
            disabled={start.isPending}
            className="gap-2 px-6"
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
                className="gap-2 px-6"
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
                className="gap-2 px-6"
              >
                <Pause className="size-4" />
                Pause
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => skip.mutate()}
                    disabled={skip.isPending}
                    aria-label="Skip phase"
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
                  variant="destructive"
                  size="icon"
                  disabled={reset.isPending}
                  aria-label="Stop timer"
                >
                  <Square className="size-4" />
                </Button>
              }
              title="Stop the timer?"
              description="This ends the current run and resets the timer to idle. Progress in this session is discarded — chat will see the timer disappear from the overlay."
              confirmLabel="Stop timer"
              onConfirm={() => reset.mutate()}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function TimerSettings() {
  const {
    workMin, setWorkMin,
    breakMin, setBreakMin,
    longBreakMin, setLongBreakMin,
    longBreakInterval, setLongBreakInterval,
    cycles, setCycles,
    saveConfig, isIdle,
  } = useTimerContext();

  const fields = [
    {
      id: "timer-work-min",
      label: "Work (min)",
      tooltip: "Duration of each focus session in minutes",
      min: 1,
      max: 120,
      value: workMin,
      set: setWorkMin,
      save: () => saveConfig({ workDuration: minutesToMs(workMin) }),
    },
    {
      id: "timer-break-min",
      label: "Break (min)",
      tooltip: "Duration of short breaks between focus sessions",
      min: 1,
      max: 60,
      value: breakMin,
      set: setBreakMin,
      save: () => saveConfig({ breakDuration: minutesToMs(breakMin) }),
    },
    {
      id: "timer-long-break-min",
      label: "Long break",
      tooltip: "Duration of the extended break in minutes",
      min: 1,
      max: 60,
      value: longBreakMin,
      set: setLongBreakMin,
      save: () => saveConfig({ longBreakDuration: minutesToMs(longBreakMin) }),
    },
    {
      id: "timer-long-break-interval",
      label: "Every (cycles)",
      tooltip: "Take a long break after this many focus sessions",
      min: 2,
      max: 20,
      value: longBreakInterval,
      set: setLongBreakInterval,
      save: () => saveConfig({ longBreakInterval }),
    },
    {
      id: "timer-pomos",
      label: "Pomos",
      tooltip: "Total number of focus sessions (pomodoros) in this run",
      min: 1,
      max: 99,
      value: cycles,
      set: setCycles,
      save: () => saveConfig({ defaultCycles: cycles }),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Label
                  htmlFor={field.id}
                  className="inline-flex items-center gap-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase"
                />
              }
            >
              {field.label}
              <Info className="size-3 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent>{field.tooltip}</TooltipContent>
          </Tooltip>
          <Input
            id={field.id}
            type="number"
            min={field.min}
            max={field.max}
            value={field.value}
            onChange={(e) => field.set(Number(e.target.value))}
            onBlur={field.save}
            disabled={!isIdle}
            className="h-8 font-mono tabular-nums"
          />
        </div>
      ))}
    </div>
  );
}

export function TimerControls() {
  return (
    <TimerProvider>
      <div className="flex flex-col items-center gap-6">
        <TimerDisplay />
        <div className="w-full">
          <TimerSettings />
        </div>
      </div>
    </TimerProvider>
  );
}
