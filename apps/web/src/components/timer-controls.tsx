"use client";

import { useEffect, useState } from "react";
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

function statusLabel(status: string): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "starting":
      return "Starting";
    case "work":
      return "Focus";
    case "break":
      return "Break";
    case "longBreak":
      return "Long Break";
    case "paused":
      return "Paused";
    case "finished":
      return "Finished";
    default:
      return status;
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

  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 2000,
  });

  const config = useQuery(trpc.config.get.queryOptions());

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
    // @ts-expect-error -- Prisma Json field causes deep type instantiation in deps
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

  // Countdown tick
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
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [state?.targetEndTime, state?.pausedWithRemaining]);

  const isPaused = status === "paused";

  return (
    <div className="space-y-4">
      {/* Timer display */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {statusLabel(status)}
          </p>
          <p className="text-3xl font-bold tabular-nums">
            {remaining !== null ? formatTime(remaining) : "--:--"}
          </p>
        </div>
        {state && status !== "idle" && (
          <p className="text-sm text-muted-foreground">
            Cycle {state.currentCycle}/{state.totalCycles}
          </p>
        )}
      </div>

      {/* Timer settings (only when idle) */}
      {isIdle && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Work (min)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={workMin}
              onChange={(e) => setWorkMin(Number(e.target.value))}
              onBlur={() => saveConfig({ workDuration: minutesToMs(workMin) })}
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
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Long break (min)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={longBreakMin}
              onChange={(e) => setLongBreakMin(Number(e.target.value))}
              onBlur={() => saveConfig({ longBreakDuration: minutesToMs(longBreakMin) })}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Long break every</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={2}
                max={20}
                value={longBreakInterval}
                onChange={(e) => setLongBreakInterval(Number(e.target.value))}
                onBlur={() => saveConfig({ longBreakInterval })}
                className="h-8"
              />
              <span className="text-xs text-muted-foreground">cycles</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {isIdle ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={99}
                value={cycles}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCycles(val);
                }}
                onBlur={() => saveConfig({ defaultCycles: cycles })}
                className="w-16"
              />
              <span className="text-xs text-muted-foreground">cycles</span>
            </div>
            <Button
              onClick={() => start.mutate({ totalCycles: cycles })}
              disabled={start.isPending}
            >
              <Play className="size-3.5" />
              Start
            </Button>
          </>
        ) : (
          <>
            {isPaused ? (
              <Button
                onClick={() => resume.mutate()}
                disabled={resume.isPending}
              >
                <Play className="size-3.5" />
                Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => pause.mutate()}
                disabled={pause.isPending}
              >
                <Pause className="size-3.5" />
                Pause
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => skip.mutate()}
              disabled={skip.isPending}
            >
              <SkipForward className="size-3.5" />
              Skip
            </Button>
            <Button
              variant="destructive"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
            >
              <Square className="size-3.5" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
