"use client";

import { useEffect, useState } from "react";

import { type TimerState, remainingFromState } from "@/lib/timer-utils";

/**
 * Shared live countdown for the dashboard controls and the overlay/preview
 * timer display (was duplicated in both). Seeds from `remainingFromState` and,
 * for a running timer, re-computes every 100ms from targetEndTime.
 *
 * Display-only: when the countdown hits zero it clamps at 0. The SERVER advances
 * phases lazily on read (maybeAdvanceOverdueTimer) and the poll picks the new
 * phase up — the client must never mutate the phase, or two open dashboards race
 * the lazy advance and double-advance past breaks.
 *
 * Returns null when there is nothing to count (idle / no target); callers that
 * want a number coalesce with `?? 0`.
 */
export function useTimerCountdown(state: TimerState | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    remainingFromState(state),
  );

  const targetEndTime = state?.targetEndTime;
  const pausedWithRemaining = state?.pausedWithRemaining;
  const status = state?.status;

  useEffect(() => {
    // Static (paused / idle / no target): set once, no interval.
    if (
      !targetEndTime ||
      (status === "paused" && pausedWithRemaining != null)
    ) {
      setRemaining(remainingFromState(state));
      return;
    }

    const tick = () => {
      setRemaining(Math.max(0, new Date(targetEndTime).getTime() - Date.now()));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
    // state is intentionally excluded — the primitive fields below fully
    // determine the countdown, and its object identity churns every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEndTime, pausedWithRemaining, status]);

  return remaining;
}
