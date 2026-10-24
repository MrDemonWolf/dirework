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
  /**
   * Whether the ring is on with px dimensions (it is skipped for non-px ones). A frame
   * too small to draw it (`ringFitsFrame`) is caught by `fitShape` on the measured box.
   */
  ringDrawn: boolean;
  ringWidth: number;
  ringGap: number;
  width: string;
  height: string;
}

type ResizeObserverCtor = new (
  callback: () => void,
) => {
  observe(target: Element): void;
  disconnect(): void;
};

/** The viewport the frame lives in: its size and resize events. */
type Viewport = Pick<
  Window,
  "innerWidth" | "innerHeight" | "addEventListener" | "removeEventListener"
>;

/**
 * Calls `onSize` with the frame's layout size and the viewport's
 * (`offsetWidth`×`offsetHeight`@`innerWidth`×`innerHeight`) now and whenever either
 * changes. Relative dimensions (`50vw`, `80%`) resize the frame, and viewport-relative
 * font sizes (`8vw`) resize the text, when the OBS source or browser viewport does,
 * without any fit input changing, so the fit must key on both. Layout size ignores
 * AutoScale's transform, and the fitted text never resizes the explicitly sized frame,
 * so this cannot loop. Without ResizeObserver or a window it reports what it can.
 * Returns the cleanup.
 */
export function observeFrameSize(
  frame: HTMLElement,
  onSize: (size: string) => void,
  Observer: ResizeObserverCtor | undefined = globalThis.ResizeObserver,
  view: Viewport | undefined = typeof window === "undefined" ? undefined : window,
): () => void {
  let last = "";
  const report = () => {
    const viewport = view ? `@${view.innerWidth}x${view.innerHeight}` : "";
    const size = `${frame.offsetWidth}x${frame.offsetHeight}${viewport}`;
    if (size === last) return;
    last = size;
    onSize(size);
  };
  report();
  const observer = Observer ? new Observer(report) : undefined;
  observer?.observe(frame);
  view?.addEventListener("resize", report);
  return () => {
    observer?.disconnect();
    view?.removeEventListener("resize", report);
  };
}

/**
 * Shrinks the timer widget's three text lines so each fits inside the ring's inner
 * area (`fitTimerLines`). The lines first render at their configured sizes (`lines`
 * is null), which is also what the server and the first client render draw; a layout
 * effect then reads each line's box once — `offsetWidth`/`offsetHeight`, the layout
 * size, so AutoScale's transform doesn't skew it — and the fitted sizes commit before
 * the browser paints, so OBS never shows the overflowing frame. It re-fits only when
 * an input changes (the countdown's length, not every tick) and when a web font
 * finishes loading, since the fallback face measures differently, and when the frame's
 * measured size changes (`observeFrameSize`).
 */
export function useTimerTextFit(input: TimerTextFitInput) {
  const frameRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const cycleRef = useRef<HTMLSpanElement>(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [frameSize, setFrameSize] = useState("");
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

  // A layout effect, so the first size lands before the first paint and the fit
  // below measures once with it instead of re-fitting after paint.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    return observeFrameSize(frame, setFrameSize);
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
    frameSize,
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
