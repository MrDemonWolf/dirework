"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { type LineFit, fitShape, fitTimerLines } from "./timer-fit";

/** Vertical gap (px) between the timer widget's text lines. */
export const TIMER_LINE_GAP_PX = 4;

export interface TimerTextFitInput {
  label: string;
  /** The countdown as drawn; only its length re-fits (digits are tabular). */
  clock: string;
  cycle: string;
  fontFamily: string;
  /** The CSS font sizes the three lines are rendered at before fitting. */
  sizes: readonly [label: string, clock: string, cycle: string];
  borderRadius: string;
  /** Whether the ring is actually drawn (it is skipped for non-px dimensions). */
  ringDrawn: boolean;
  ringWidth: number;
  ringGap: number;
  width: string;
  height: string;
}

/**
 * Shrinks the timer widget's three text lines so each fits inside the ring's inner
 * area (`fitTimerLines`). The lines first render at their configured sizes (`lines`
 * is null), which is also what the server and the first client render draw; a layout
 * effect then reads each line's box once — `offsetWidth`/`offsetHeight`, the layout
 * size, so AutoScale's transform doesn't skew it — and the fitted sizes commit before
 * the browser paints, so OBS never shows the overflowing frame. It re-fits only when
 * an input changes (the countdown's length, not every tick) and when a web font
 * finishes loading, since the fallback face measures differently.
 */
export function useTimerTextFit(input: TimerTextFitInput) {
  const frameRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const cycleRef = useRef<HTMLSpanElement>(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [fit, setFit] = useState<{ key: string; lines: LineFit[] } | null>(null);

  useEffect(() => {
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!fonts) return;
    let active = true;
    const refit = () => {
      if (active) setFontEpoch((epoch) => epoch + 1);
    };
    fonts.ready.then(refit, () => {});
    fonts.addEventListener("loadingdone", refit);
    return () => {
      active = false;
      fonts.removeEventListener("loadingdone", refit);
    };
  }, []);

  const { borderRadius, ringDrawn, ringWidth, ringGap } = input;
  const key = JSON.stringify([
    input.label,
    input.clock.length,
    input.cycle,
    input.fontFamily,
    input.sizes,
    input.width,
    input.height,
    borderRadius,
    ringDrawn,
    ringWidth,
    ringGap,
    fontEpoch,
  ]);
  // A fit measured for other inputs is stale: render at the configured sizes so the
  // effect below measures the natural boxes.
  const lines = fit?.key === key ? fit.lines : null;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const spans = [labelRef.current, clockRef.current, cycleRef.current];
    if (!frame || spans.some((span) => !span)) return;
    const shape = fitShape(frame.offsetWidth, frame.offsetHeight, borderRadius, {
      enabled: ringDrawn,
      width: ringWidth,
      gap: ringGap,
    });
    const sizes = spans.map((span) => ({
      width: span?.offsetWidth ?? 0,
      height: span?.offsetHeight ?? 0,
    }));
    setFit({ key, lines: fitTimerLines(shape, frame.offsetHeight, sizes, TIMER_LINE_GAP_PX) });
  }, [key, borderRadius, ringDrawn, ringWidth, ringGap]);

  return { frameRef, labelRef, clockRef, cycleRef, lines };
}
