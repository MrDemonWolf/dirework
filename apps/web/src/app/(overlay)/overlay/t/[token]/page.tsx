"use client";

import { useRef } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useParams } from "next/navigation";

import { defaultTimerStyles } from "@/lib/theme-presets";
import { TimerDisplay } from "@/components/timer-display";
import { trpc } from "@/utils/trpc";

const defaultTimerState = {
  status: "idle",
  targetEndTime: null,
  pausedWithRemaining: null,
  currentCycle: 1,
  totalCycles: 4,
};

const defaultLabels: Record<string, string> = {
  idle: "Ready",
  starting: "Starting",
  work: "Focus",
  break: "Break",
  longBreak: "Long Break",
  paused: "Paused",
  finished: "Done",
};

export default function TimerOverlayPage() {
  const { token } = useParams<{ token: string }>();

  const { data, status } = useSubscription({
    ...trpc.overlay.onTimerState.subscriptionOptions({ token }),
    enabled: true,
  });

  const lastKnownDataRef = useRef(data);
  if (data) lastKnownDataRef.current = data;

  const current = data ?? lastKnownDataRef.current;
  if (!current && (status === "connecting" || status === "idle")) return null;

  const timerState = current?.timerState ?? defaultTimerState;
  const timerStyles = current?.timerStyles ?? defaultTimerStyles;
  const timerConfig = current?.timerConfig;

  const displayConfig = {
    ...timerStyles,
    labels: timerConfig?.labels ?? defaultLabels,
    showHours: timerConfig?.showHours ?? false,
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <TimerDisplay
        config={displayConfig}
        state={timerState as { status: string; targetEndTime: string | null; pausedWithRemaining: number | null; currentCycle: number; totalCycles: number }}
      />
    </div>
  );
}
