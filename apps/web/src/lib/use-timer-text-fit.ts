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
 * The frame's layout size and the viewport's as one string,
 * `offsetWidth`×`offsetHeight`@`innerWidth`×`innerHeight` (no `@…` without a window).
 * `observeFrameSize` reports it and each fit records it, so the two compare equal for
 * the same box.
 */
export function frameSizeOf(frame: HTMLElement, view: Viewport | undefined): string {
  const viewport = view ? `@${view.innerWidth}x${view.innerHeight}` : "";
  return `${frame.offsetWidth}x${frame.offsetHeight}${viewport}`;
}

/**
 * Calls `onSize` with the frame's layout size and the viewport's (`frameSizeOf`) now
 * and whenever either changes. Relative dimensions (`50vw`, `80%`) resize the frame, and
 * viewport-relative font sizes (`8vw`) resize the text, when the OBS source or browser
 * viewport does, without any fit input changing, so the fit must key on both. Layout
 * size ignores AutoScale's transform, and the fitted text never resizes the explicitly
 * sized frame, so this cannot loop. Without ResizeObserver or a window it reports what
 * it can. Returns the cleanup.
 */
export function observeFrameSize(
  frame: HTMLElement,
  onSize: (size: string) => void,
  Observer: ResizeObserverCtor | undefined = globalThis.ResizeObserver,
  view: Viewport | undefined = typeof window === "undefined" ? undefined : window,
): () => void {
  let last = "";
  const report = () => {
    const size = frameSizeOf(frame, view);
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

/** The part of `document.fonts` the fit watches. */
type FontLoads = Pick<FontFaceSet, "ready" | "addEventListener" | "removeEventListener">;

/**
 * Calls `onLoaded` when a web font finishes loading, since the fallback face measures
 * differently: on every `loadingdone`, and once `fonts.ready` resolves unless every
 * font had already loaded when the fit was measured (`loadedAtFit`). `ready` calls back
 * even when it resolved long before (a remount with the fonts in place), and refitting
 * then would only measure the same boxes again. Returns the cleanup.
 */
export function watchFontLoads(
  fonts: FontLoads,
  onLoaded: () => void,
  loadedAtFit: () => boolean,
): () => void {
  let active = true;
  const refit = () => {
    if (active) onLoaded();
  };
  fonts.ready.then(
    () => {
      if (!loadedAtFit()) refit();
    },
    () => {},
  );
  fonts.addEventListener("loadingdone", refit);
  return () => {
    active = false;
    fonts.removeEventListener("loadingdone", refit);
  };
}

/** The per-line scales, with the inputs (`key`) and frame size they were measured for. */
interface TextFit {
  key: string;
  frameSize: string;
  lines: LineFit[];
}

/**
 * Shrinks the timer widget's three text lines so each fits inside the ring's inner
 * area (`fitTimerLines`). The lines first render at their configured sizes (`lines`
 * is null), which is also what the server and the first client render draw; a layout
 * effect then reads each line's box once — `offsetWidth`/`offsetHeight`, the layout
 * size, so AutoScale's transform doesn't skew it — and the fitted sizes commit before
 * the browser paints, so OBS never shows the overflowing frame; a mount measures once.
 * It re-fits only when an input changes (the countdown's length, not every tick), when
 * a web font finishes loading after the fit measured (`watchFontLoads`), since the
 * fallback face measures differently, and when the frame's size changes from the one
 * the fit measured (`observeFrameSize`).
 */
export function useTimerTextFit(input: TimerTextFitInput) {
  const frameRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const cycleRef = useRef<HTMLSpanElement>(null);
  // Whether every web font had loaded when the current fit was measured.
  const fontsLoadedAtFit = useRef(false);
  const [fontEpoch, setFontEpoch] = useState(0);
  // The frame's size: seeded by each fit with the box it measured, then changed by
  // observeFrameSize when the frame or the viewport resizes.
  const [frameSize, setFrameSize] = useState("");
  const [fit, setFit] = useState<TextFit | null>(null);

  useEffect(() => {
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!fonts) return;
    return watchFontLoads(
      fonts,
      () => setFontEpoch((epoch) => epoch + 1),
      () => fontsLoadedAtFit.current,
    );
  }, []);

  // observeFrameSize reports synchronously first. In a layout effect, that report is the
  // box the mount's fit (below) measures in this same commit and seeds frameSize with,
  // so it is skipped: every later report is a resize.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let first = true;
    return observeFrameSize(frame, (size) => {
      if (first) first = false;
      else setFrameSize(size);
    });
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
  // A fit holds for the inputs it was measured with, at the frame size it measured. A
  // stale one renders the configured sizes, so the effect below measures the natural boxes.
  const lines = fit?.key === key && fit.frameSize === frameSize ? fit.lines : null;

  useLayoutEffect(() => {
    // Only a render at the configured sizes is measured; a fitted one already was.
    if (lines) return;
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
    // After the reads: a layout that needs a face not loaded yet starts loading it.
    fontsLoadedAtFit.current = document.fonts?.status === "loaded";
    // Seeding frameSize with the measured box keeps this fit current, so a later report
    // of the same box (the observer catching up with a resize the inputs made) is a no-op.
    const measured = frameSizeOf(frame, window);
    setFrameSize(measured);
    setFit({
      key,
      frameSize: measured,
      lines: fitTimerLines(shape, frame.offsetHeight, sizes, TIMER_LINE_GAP_PX),
    });
  }, [lines, key, borderRadius, ringDrawn, ringWidth, ringGap]);

  return { frameRef, labelRef, clockRef, cycleRef, lines };
}
