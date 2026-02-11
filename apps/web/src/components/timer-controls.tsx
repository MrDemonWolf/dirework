"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, SkipForward, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

const DEFAULT_TIMER_CONFIG = {
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

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const DEFAULT_LABELS: Record<string, string> = {
  idle: "Ready",
  starting: "Starting",
  work: "Focus",
  break: "Break",
  longBreak: "Long Break",
  paused: "Paused",
  finished: "Finished",
};

function statusColor(status: string): string {
  switch (status) {
    case "work":
      return "text-primary";
    case "break":
    case "longBreak":
      return "text-emerald-500";
    case "paused":
      return "text-amber-500";
    case "finished":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

export function TimerControls() {
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

  // Extract phase labels from config columns (fall back to defaults)
  const configLabels: Record<string, string> = config.data
    ? {
        idle: config.data.labelIdle,
        starting: config.data.labelStarting,
        work: config.data.labelWork,
        break: config.data.labelBreak,
        longBreak: config.data.labelLongBreak,
        paused: config.data.labelPaused,
        finished: config.data.labelFinished,
      }
    : DEFAULT_LABELS;

  const updateTimerConfig = useMutation({
    ...trpc.config.updateTimer.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.config.get.queryKey() });
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyRecord = Record<string, any>;

  // Initialize local state from config
  useEffect(() => {
    if (!config.data || configLoaded) return;
    const configData = config.data as AnyRecord;
    const tc = (configData.timer ?? {}) as Record<string, number>;
    setWorkMin(msToMinutes(tc.workDuration ?? DEFAULT_TIMER_CONFIG.workDuration));
    setBreakMin(msToMinutes(tc.breakDuration ?? DEFAULT_TIMER_CONFIG.breakDuration));
    setLongBreakMin(msToMinutes(tc.longBreakDuration ?? DEFAULT_TIMER_CONFIG.longBreakDuration));
    setLongBreakInterval(tc.longBreakInterval ?? DEFAULT_TIMER_CONFIG.longBreakInterval);
    setCycles(tc.defaultCycles ?? DEFAULT_TIMER_CONFIG.defaultCycles);
    setConfigLoaded(true);
    // @ts-expect-error -- Prisma Json fields cause deep type instantiation in dependency array
  }, [config.data, configLoaded]);

  const saveConfig = (overrides: Partial<typeof DEFAULT_TIMER_CONFIG>) => {
    const configData = config.data as AnyRecord | undefined;
    const current = (configData?.timer ?? {}) as AnyRecord;
    updateTimerConfig.mutate({
      timer: {
        ...current,
        ...overrides,
      },
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.timer.get.queryKey() });
  };

  const start = useMutation({
    ...trpc.timer.start.mutationOptions(),
    onSuccess: invalidate,
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
  });

  const resume = useMutation({
    ...trpc.timer.resume.mutationOptions(),
    onSuccess: invalidate,
  });

  const skip = useMutation({
    ...trpc.timer.skip.mutationOptions(),
    onSuccess: invalidate,
  });

  const reset = useMutation({
    ...trpc.timer.reset.mutationOptions(),
    onSuccess: invalidate,
  });

  const state = timer.data;
  const status = state?.status ?? "idle";
  const isIdle = status === "idle" || status === "finished";
  const isPaused = status === "paused";
  const isRunning = !isIdle && !isPaused;

  // Countdown tick + auto-transition
  useEffect(() => {
    if (!state?.targetEndTime) {
      if (state?.pausedWithRemaining) {
        setRemaining(state.pausedWithRemaining);
      } else {
        setRemaining(null);
      }
      return;
    }

    const tick = () => {
      const ms = new Date(state.targetEndTime!).getTime() - Date.now();
      setRemaining(Math.max(0, ms));

      // Auto-transition when countdown reaches 0
      if (ms <= 0 && !transitioningRef.current) {
        transitioningRef.current = true;
        nextPhase.mutate();
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [state?.targetEndTime, state?.pausedWithRemaining]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset transition lock when status changes
  useEffect(() => {
    transitioningRef.current = false;
  }, [status]);

  // Display time: show configured work duration when idle, otherwise countdown
  const displayTime = isIdle
    ? formatTime(minutesToMs(workMin))
    : remaining !== null
      ? formatTime(remaining)
      : "--:--";

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
      <div className="order-1 flex-1">
        <div className="flex flex-col items-center gap-4">
          <p className={`text-sm font-semibold uppercase tracking-widest ${statusColor(status)}`}>
            {configLabels[status] ?? DEFAULT_LABELS[status] ?? status}
          </p>
          <p className="font-heading text-6xl font-bold tabular-nums tracking-tight">
            {displayTime}
          </p>
          {state && !isIdle ? (
            <p className="text-sm text-muted-foreground">
              Pomo {state.currentCycle} / {state.totalCycles}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => skip.mutate()}
                  disabled={skip.isPending}
                  title="Skip phase"
                >
                  <SkipForward className="size-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => reset.mutate()}
                  disabled={reset.isPending}
                  title="Stop timer"
                >
                  <Square className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="order-2 w-44 shrink-0">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Work (min)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={workMin}
              onChange={(e) => setWorkMin(Number(e.target.value))}
              onBlur={() => saveConfig({ workDuration: minutesToMs(workMin) })}
              disabled={!isIdle}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Break (min)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
              onBlur={() => saveConfig({ breakDuration: minutesToMs(breakMin) })}
              disabled={!isIdle}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Long break</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={longBreakMin}
              onChange={(e) => setLongBreakMin(Number(e.target.value))}
              onBlur={() => saveConfig({ longBreakDuration: minutesToMs(longBreakMin) })}
              disabled={!isIdle}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Every (cycles)</Label>
            <Input
              type="number"
              min={2}
              max={20}
              value={longBreakInterval}
              onChange={(e) => setLongBreakInterval(Number(e.target.value))}
              onBlur={() => saveConfig({ longBreakInterval })}
              disabled={!isIdle}
              className="h-8"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Pomos</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={cycles}
              onChange={(e) => setCycles(Number(e.target.value))}
              onBlur={() => saveConfig({ defaultCycles: cycles })}
              disabled={!isIdle}
              className="h-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
