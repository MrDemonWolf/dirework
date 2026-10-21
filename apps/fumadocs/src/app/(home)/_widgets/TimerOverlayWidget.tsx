"use client";

// Live mock of the DireWork OBS timer overlay for the marketing home page. Shares geometry,
// clock formatting and the demo session with the real overlay (apps/web) via
// `@dirework/overlay-kit`, so the docs preview cannot drift from what streamers actually get.

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  DEMO_SESSION,
  SQUIRCLE_RADIUS,
  cycleLabel,
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

/** The demo session's focus block and where it starts, in whole seconds. */
const TOTAL = DEMO_SESSION.phaseMs / 1000;
const START = DEMO_SESSION.remainingMs / 1000;
const CYCLE = cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total);
/** Rendered box size in px; the SVG viewBox uses the same units. */
const SIZE = 250;
const STROKE = 8;
// Half the stroke keeps the ring inside the viewBox; the extra 2px is breathing room.
const INSET = STROKE / 2 + 2;
const RADIUS = SIZE * SQUIRCLE_RADIUS;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Live prefers-reduced-motion. The server snapshot is false, so SSR and the first
 * client render agree (no hydration mismatch); a preference change made while the
 * page is open applies immediately.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Squircle-ring timer overlay mock. Counts down once a second from the demo session's
 * mid-block value and wraps back to a full block at zero, and stops ticking while `paused`
 * (the preview's pause button). Under reduced motion the digits still tick (a text change
 * is not motion) but the ring steps instead of sweeping, matching how the real overlay
 * honours the preference.
 */
export function TimerOverlayWidget({
  theme = OVERLAY_THEMES[DEFAULT_OVERLAY_THEME],
  paused = false,
}: {
  theme?: OverlayTheme;
  paused?: boolean;
}) {
  // Start partway through so the ring reads as "in progress" on first paint.
  const [remaining, setRemaining] = useState(START);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (paused) return;
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
      aria-label={`Pomodoro timer overlay: ${DEMO_SESSION.phaseLabel.toLowerCase()}, ${fmt(remaining)} remaining`}
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
          style={{ transition: reducedMotion ? undefined : "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div style={{ position: "relative", textAlign: "center", color: theme.text }}>
        <div
          style={{
            fontSize: 18,
            // Docs headings use Montserrat at 700/800 (see app/layout.tsx).
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          {DEMO_SESSION.phaseLabel}
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
        <div style={{ fontSize: 16, color: hexToRgba(theme.text, 0.6) }}>{CYCLE}</div>
      </div>
    </div>
  );
}
