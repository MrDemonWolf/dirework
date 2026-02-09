"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { deepMerge } from "@/lib/deep-merge";
import { defaultTimerStyles } from "@/lib/theme-presets";
import { TimerDisplay } from "@/components/timer-display";
import { trpc } from "@/utils/trpc";

const POLL_INTERVAL = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

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

  const mergedStyles = deepMerge(defaultTimerStyles, ts);
  const displayConfig = {
    dimensions: mergedStyles.dimensions as { width: string; height: string },
    background: mergedStyles.background as { color: string; opacity: number; borderRadius: string },
    ring: mergedStyles.ring as { enabled: boolean; trackColor: string; trackOpacity: number; fillColor: string; fillOpacity: number; width: number; gap: number },
    text: mergedStyles.text as { color: string; outlineColor: string; outlineSize: string; fontFamily: string },
    fontSizes: mergedStyles.fontSizes as { label: string; time: string; cycle: string },
    labels: (tc.labels ?? {
      work: "Focus",
      break: "Break",
      longBreak: "Long Break",
      starting: "Starting",
      finished: "Done",
    }) as Record<string, string>,
    showHours: (tc.showHours ?? false) as boolean,
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
