"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";

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

  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 2000,
  });

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
  const isRunning = ["starting", "work", "break", "longBreak"].includes(status);
  const isPaused = status === "paused";

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

      {/* Controls */}
      <div className="flex items-center gap-2">
        {status === "idle" || status === "finished" ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={99}
                value={cycles}
                onChange={(e) => setCycles(Number(e.target.value))}
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
