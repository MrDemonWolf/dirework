"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live mock of the Dirework OBS timer overlay (squircle ring shape).
 * Mirrors the real overlay: `roundedRectPath()` + `formatTime()` from
 * apps/web/src/lib/timer-utils.ts. Animates a fake focus countdown.
 */

// Copied from apps/web/src/lib/timer-utils.ts — keep in sync.
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  r = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + w / 2} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `Z`,
  ].join(" ");
}

function fmt(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TOTAL = 25 * 60; // 25:00 focus block
const SIZE = 250;
const STROKE = 8;
const INSET = STROKE / 2 + 2;
const RADIUS = SIZE * 0.22;

export function TimerOverlayWidget() {
  // Start partway through so the ring reads as "in progress" on first paint.
  const [remaining, setRemaining] = useState(18 * 60 + 24);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 0 ? TOTAL : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = TOTAL - remaining;
  const progress = elapsed / TOTAL;

  const w = SIZE - INSET * 2;
  const path = roundedRectPath(INSET, INSET, w, w, RADIUS);
  // Perimeter of a rounded square: 4 straight sides + circle of radius r.
  const straight = 4 * (w - 2 * RADIUS);
  const corners = 2 * Math.PI * RADIUS;
  const perimeter = straight + corners;
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
        background: "rgba(28,28,30,0.92)",
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
        <path d={path} fill="none" stroke="#ffffff" strokeOpacity={0.1} strokeWidth={STROKE} />
        <path
          d={path}
          fill="none"
          stroke="#34c759"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          style={{ transition: reduced.current ? undefined : "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div style={{ position: "relative", textAlign: "center", color: "#fff" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#34c759",
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
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }}>Cycle 2 / 4</div>
      </div>
    </div>
  );
}
