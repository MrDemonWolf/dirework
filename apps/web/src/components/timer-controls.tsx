"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
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
import { DASHBOARD_TIMER_QUERY_OPTS } from "@/lib/poll-intervals";
import { type TimerState, formatClock, resolvePhaseDuration } from "@/lib/timer-utils";
import { useTimerCountdown } from "@/lib/use-timer-countdown";
import { TIMER_TONES, TIMER_PHASE_COLOR, toTimerStatus } from "@/lib/status-tones";
import {
  DEFAULT_PHASE_LABELS,
  TIMER_CONFIG_DEFAULTS,
  type PhaseLabelsConfig,
  type TimerStatus,
} from "@/lib/config-types";
import { describeTrpcError } from "@/lib/trpc-errors";
import { trpc } from "@/utils/trpc";

function msToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

function minutesToMs(min: number): number {
  return min * 60000;
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
      {Array.from({ length: total }, (_, index) => index + 1).map((cycleNum) => {
        const isDone = cycleNum < current;
        const isCurrent = cycleNum === current;
        return (
          <span
            key={cycleNum}
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
  status: TimerStatus;
  isIdle: boolean;
  isPaused: boolean;
  /** Full length (ms) of the phase being measured; null while idle/finished. */
  totalDuration: number | null;
  state: TimerState | null;
  configLabels: PhaseLabelsConfig;
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
  const [cycles, setCycles] = useState(TIMER_CONFIG_DEFAULTS.defaultCycles);
  const [workMin, setWorkMin] = useState(msToMinutes(TIMER_CONFIG_DEFAULTS.workDuration));
  const [breakMin, setBreakMin] = useState(msToMinutes(TIMER_CONFIG_DEFAULTS.breakDuration));
  const [longBreakMin, setLongBreakMin] = useState(
    msToMinutes(TIMER_CONFIG_DEFAULTS.longBreakDuration),
  );
  const [longBreakInterval, setLongBreakInterval] = useState(
    TIMER_CONFIG_DEFAULTS.longBreakInterval,
  );
  const [configLoaded, setConfigLoaded] = useState(false);

  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    // refetchIntervalInBackground is left false so the control panel stops
    // polling when its tab is hidden (Cloudflare free tier).
    ...DASHBOARD_TIMER_QUERY_OPTS,
  });

  const config = useQuery(trpc.config.get.queryOptions());

  const configLabels = config.data?.timerConfig?.labels ?? DEFAULT_PHASE_LABELS;

  const updateTimerConfig = useMutation({
    ...trpc.config.updateTimerConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
      // Blur-autosave needs visible confirmation — Styles/Bot get a Save bar,
      // this surface's only feedback is the toast.
      toast.success("Timer settings saved");
    },
    onError: (err) => {
      toast.error(`Couldn't save timer settings: ${describeTrpcError(err)}`);
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

  const mutationError = (action: string) => (err: unknown) => {
    toast.error(`Couldn't ${action} the timer: ${describeTrpcError(err)}`);
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

  // The phase's full length comes from the (locally edited) minutes; while
  // paused we measure against the phase the timer froze in — resolvePhaseDuration
  // owns that branch. Idle/finished return null and the rail reads empty.
  // The live countdown itself runs inside TimerInstrument, so its ticks don't
  // re-render the provider and every other context consumer.
  const totalDuration = resolvePhaseDuration(status, state?.pausedFromStatus, {
    workDuration: minutesToMs(workMin),
    breakDuration: minutesToMs(breakMin),
    longBreakDuration: minutesToMs(longBreakMin),
    startingDuration:
      config.data?.timerConfig?.startingDuration ?? TIMER_CONFIG_DEFAULTS.startingDuration,
  });

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
        totalDuration,
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
    totalDuration,
    state,
    configLabels,
    start,
    pause,
    resume,
    skip,
    reset,
  } = useTimerContext();

  const remaining = useTimerCountdown(state);

  const displayTime = isIdle
    ? formatClock(minutesToMs(workMin))
    : remaining !== null
      ? formatClock(remaining)
      : "--:--";

  // Progress through the current phase (0–100) for the instrument rail.
  const progressPct =
    !isIdle && totalDuration && remaining !== null
      ? Math.min(100, Math.max(0, 100 * (1 - remaining / totalDuration)))
      : 0;

  // Runtime guard: the wire value is untyped JSON, so an unknown status reads as idle.
  const timerStatus = toTimerStatus(status);
  const { tone, pulse } = TIMER_TONES[timerStatus];
  const phaseColor = TIMER_PHASE_COLOR[timerStatus];
  const phaseLabel = configLabels[timerStatus];

  // One primary transport button for every state (Start / Pause / Resume), so
  // the same element keeps keyboard focus across state changes.
  const primary = isIdle
    ? {
        label: "Start",
        Icon: Play,
        variant: "default" as const,
        onClick: () => start.mutate({ totalCycles: cycles }),
        pending: start.isPending,
      }
    : isPaused
      ? {
          label: "Resume",
          Icon: Play,
          variant: "default" as const,
          onClick: () => resume.mutate(),
          pending: resume.isPending,
        }
      : {
          label: "Pause",
          Icon: Pause,
          variant: "outline" as const,
          onClick: () => pause.mutate(),
          pending: pause.isPending,
        };

  // Stopping (or finishing) unmounts the skip/stop cluster; if that dropped
  // focus to <body>, hand it to the primary button instead of the page top.
  const primaryRef = useRef<HTMLButtonElement>(null);
  const wasIdle = useRef(isIdle);
  useEffect(() => {
    const active = document.activeElement;
    if (isIdle && !wasIdle.current && (!active || active === document.body)) {
      primaryRef.current?.focus();
    }
    wasIdle.current = isIdle;
  }, [isIdle]);

  return (
    <div className="flex flex-col items-center gap-5">
      <StatusChip tone={tone} label={phaseLabel} pulse={pulse} />
      {/* Announces phase changes (start / pause / stop / chat-driven) to screen readers. */}
      <span role="status" aria-live="polite" className="sr-only">
        Timer: {phaseLabel}
      </span>
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
        <Button
          ref={primaryRef}
          variant={primary.variant}
          size="lg"
          onClick={primary.onClick}
          disabled={primary.pending}
          focusableWhenDisabled
          className="h-12 gap-2 px-8 text-base"
        >
          <primary.Icon className="size-4" />
          {primary.label}
        </Button>
        {!isIdle && (
          /* Segmented skip/stop cluster */
          <div className="flex divide-x divide-border/50 overflow-hidden rounded-lg border border-border/50">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => skip.mutate()}
                    disabled={skip.isPending}
                    focusableWhenDisabled
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
                  focusableWhenDisabled
                  aria-label="Stop timer"
                  className="h-12 w-12 rounded-none border-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Square className="size-4" />
                </Button>
              }
              title="Stop the timer?"
              description="This ends the current run and resets the timer. Your progress is lost — the overlay goes back to its idle preview."
              confirmLabel="Stop timer"
              onConfirm={() => reset.mutate()}
            />
          </div>
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
        <div key={field.id} className="grid grid-cols-[6.75rem_4.5rem_auto] items-center gap-2">
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
              // autosaves 0 and bounces off the server with a raw error. Round
              // first: the server only takes whole numbers, and "2.5" types fine.
              const clamped = Math.min(
                field.max,
                Math.max(field.min, Math.round(field.value) || field.min),
              );
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
