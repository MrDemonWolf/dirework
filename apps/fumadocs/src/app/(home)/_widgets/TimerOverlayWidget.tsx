"use client";

// Live mock of the Dirework OBS timer overlay for the marketing home page. Shares geometry and
// clock formatting with the real overlay (apps/web) via `@dirework/overlay-kit`, so the docs
// preview cannot drift from what streamers actually get.

import { useEffect, useRef, useState } from "react";

import {
  SQUIRCLE_RADIUS,
  formatClock,
  roundedRectPath,
  roundedRectPerimeter,
} from "@dirework/overlay-kit";

import {
  OVERLAY_THEMES,
  DEFAULT_OVERLAY_THEME,
  type OverlayTheme,
} from "./overlay-themes.generated";
import { hexToRgba } from "./theme-util";

/** Format a seconds count as MM:SS via the shared ms-based clock helper. */
function fmt(totalSeconds: number): string {
  return formatClock(totalSeconds * 1000);
}

const TOTAL = 25 * 60; // 25:00 focus block
/** Rendered box size in px; the SVG viewBox uses the same units. */
const SIZE = 250;
const STROKE = 8;
// Half the stroke keeps the ring inside the viewBox; the extra 2px is breathing room.
const INSET = STROKE / 2 + 2;
const RADIUS = SIZE * SQUIRCLE_RADIUS;

/**
 * Squircle-ring timer overlay mock. Counts down once a second from a mid-session value and
 * wraps back to a full 25:00 at zero. Stops ticking while `paused`, and never ticks when the
 * viewer prefers reduced motion (the static frame still shows progress).
 */
export function TimerOverlayWidget({
  theme = OVERLAY_THEMES[DEFAULT_OVERLAY_THEME],
  paused = false,
}: {
  theme?: OverlayTheme;
  paused?: boolean;
}) {
  // Start partway through so the ring reads as "in progress" on first paint.
  const [remaining, setRemaining] = useState(18 * 60 + 24);
  // A ref, not state: updating it needs no re-render of its own. It is sampled only when the
  // effect runs (mount and each `paused` change), so it does not track a live preference change.
  const reduced = useRef(false);

  // matchMedia runs in the effect, not during render, so SSR and the first client render
  // agree (no hydration mismatch).
  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || paused) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 0 ? TOTAL : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const elapsed = TOTAL - remaining;
  const progress = elapsed / TOTAL;

  const w = SIZE - INSET * 2;
  const path = roundedRectPath(INSET, INSET, w, w, RADIUS);
  const perimeter = roundedRectPerimeter(w, w, RADIUS);
  // One dash the length of the whole path; shifting its offset reveals `progress` of the ring.
  const dash = perimeter;
  const offset = perimeter * (1 - progress);

  return (
    <div
      role="img"
      aria-label={`Pomodoro timer overlay: focus, ${fmt(remaining)} remaining`}
      style={{
        width: SIZE,
        maxWidth: "100%",
        aspectRatio: "1",
        position: "relative",
        background: hexToRgba(theme.bg, 0.92),
        borderRadius: "22%",
        boxShadow: "0 24px 60px -24px rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        userSelect: "none",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <path d={path} fill="none" stroke={hexToRgba(theme.text, 0.18)} strokeWidth={STROKE} />
        <path
          d={path}
          fill="none"
          stroke={theme.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          // 1s linear matches the tick, as in the real overlay, so the ring sweeps smoothly.
          style={{ transition: reduced.current ? undefined : "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div style={{ position: "relative", textAlign: "center", color: theme.text }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          Focus
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}
        >
          {fmt(remaining)}
        </div>
        <div style={{ fontSize: 16, color: hexToRgba(theme.text, 0.6) }}>Cycle 2 / 4</div>
      </div>
    </div>
  );
}
