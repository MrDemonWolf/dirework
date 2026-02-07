"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { TimerDisplay } from "@/components/timer-display";
import { trpc } from "@/utils/trpc";

const POLL_INTERVAL = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const defaultTimerConfig = {
  dimensions: { width: "250px", height: "250px" },
  background: { color: "#000000", opacity: 0.5, borderRadius: "50%" },
  text: {
    color: "#ffffff",
    outlineColor: "#000000",
    outlineSize: "0px",
    fontFamily: "Inter",
  },
  fontSizes: { label: "24px", time: "48px", cycle: "20px" },
  labels: {
    work: "Focus",
    break: "Break",
    longBreak: "Long Break",
    starting: "Starting",
    finished: "Done",
  },
  showHours: false,
};

const defaultTimerState = {
  status: "idle",
  targetEndTime: null,
  pausedWithRemaining: null,
  currentCycle: 1,
  totalCycles: 4,
};

export default function TimerOverlayPage() {
  const { token } = useParams<{ token: string }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useQuery({
    ...(trpc.overlay.getTimerState.queryOptions({ token }) as any),
    refetchInterval: POLL_INTERVAL,
  }) as {
    isLoading: boolean;
    data: { timerState: AnyRecord | null; config: AnyRecord | null } | null | undefined;
  };

  if (isLoading) return null;

  const timerState = data?.timerState ?? defaultTimerState;
  const tc = ((data?.config?.timer as AnyRecord) ?? {}) as AnyRecord;
  const ts = ((data?.config?.timerStyles as AnyRecord) ?? {}) as AnyRecord;

  const displayConfig = {
    dimensions: ts.dimensions ?? defaultTimerConfig.dimensions,
    background: ts.background ?? defaultTimerConfig.background,
    text: ts.text ?? defaultTimerConfig.text,
    fontSizes: ts.fontSizes ?? defaultTimerConfig.fontSizes,
    labels: tc.labels ?? defaultTimerConfig.labels,
    showHours: tc.showHours ?? defaultTimerConfig.showHours,
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
