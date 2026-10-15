"use client";

import { useEffect, useState } from "react";

import { type TimerState, msUntilNextSecond, remainingFromState } from "@/lib/timer-utils";

/**
 * Shared live countdown for the dashboard controls and the overlay/preview
 * timer display (was duplicated in both). Seeds from `remainingFromState` and,
 * for a running timer, re-computes from targetEndTime each time the displayed
 * second changes — clocks show whole seconds, so a faster tick only burns
 * renders and repaints on the streamer's machine.
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
  const [remaining, setRemaining] = useState<number | null>(() => remainingFromState(state));

  // The primitives fully determine the countdown; the state object's identity
  // churns on every poll, so it is deliberately not an effect dependency.
  const targetEndTime = state?.targetEndTime;
  const pausedWithRemaining = state?.pausedWithRemaining;
  const status = state?.status;

  useEffect(() => {
    // Static (paused / idle / no target): set once, no timer.
    if (!targetEndTime || (status === "paused" && pausedWithRemaining != null)) {
      setRemaining(
        status ? remainingFromState({ status, targetEndTime, pausedWithRemaining }) : null,
      );
      return;
    }

    const end = new Date(targetEndTime).getTime();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      setRemaining(left);
      if (left > 0) timeout = setTimeout(tick, msUntilNextSecond(left));
    };
    tick();
    return () => clearTimeout(timeout);
  }, [targetEndTime, pausedWithRemaining, status]);

  return remaining;
}
