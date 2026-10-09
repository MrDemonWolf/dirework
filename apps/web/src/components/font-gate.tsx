"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Never hide an overlay longer than this waiting on a slow font. */
const MAX_WAIT_MS = 1500;

/**
 * Keeps an overlay `visibility: hidden` until the fonts its first render asked
 * for have loaded (or a short timeout passes), so an OBS source refresh never
 * draws the fallback font and then reflows on stream. Hidden content is still
 * laid out, which is what starts the font downloads; the frame wait lets that
 * layout happen before `document.fonts.ready` is read.
 */
export function FontGate({ className, children }: { className?: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!document.fonts) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReady(true);
    };
    const timer = setTimeout(done, MAX_WAIT_MS);
    const frame = requestAnimationFrame(() => {
      document.fonts.ready.then(done, done);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={className} style={ready ? undefined : { visibility: "hidden" }}>
      {children}
    </div>
  );
}
