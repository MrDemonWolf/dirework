"use client";

import { useEffect, useState } from "react";

interface RingConfig {
  enabled: boolean;
  trackColor: string;
  trackOpacity: number;
  fillColor: string;
  fillOpacity: number;
  width: number;
  gap: number;
}

interface TimerConfig {
  dimensions: { width: string; height: string };
  background: { color: string; opacity: number; borderRadius: string };
  ring: RingConfig;
  text: {
    color: string;
    outlineColor: string;
    outlineSize: string;
    fontFamily: string;
  };
  fontSizes: { label: string; time: string; cycle: string };
  labels: Record<string, string>;
  showHours: boolean;
}

interface TimerState {
  status: string;
  targetEndTime: string | null;
  pausedWithRemaining: number | null;
  currentCycle: number;
  totalCycles: number;
}

function toHexOpacity(opacity: number): string {
  return Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
}

function formatTime(
  ms: number,
  showHours: boolean,
): { hours: string; minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(showHours ? minutes : Math.floor(totalSeconds / 60)).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

// Default durations for progress calculation when totalDuration is not provided
const STATUS_DURATIONS: Record<string, number> = {
  work: 25 * 60 * 1000,
  break: 5 * 60 * 1000,
  longBreak: 15 * 60 * 1000,
  starting: 5 * 1000,
};

/**
 * Build a rounded-rectangle SVG path starting from top-center, going clockwise.
 * This gives us a continuous path we can use with strokeDasharray for progress.
 */
function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  r = Math.min(r, w / 2, h / 2);
  // Start at top-center, draw clockwise
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

function ProgressRing({
  progress,
  size,
  ring,
  borderRadius,
}: {
  progress: number;
  size: number;
  ring: RingConfig;
  borderRadius: string;
}) {
  const strokeWidth = ring.width;
  const gap = ring.gap;
  const inset = strokeWidth / 2 + gap;
  const innerSize = size - inset * 2;

  // Determine if we should draw a circle or rounded rect
  const isCircle = borderRadius === "50%" || borderRadius === "50";

  if (isCircle) {
    const radius = innerSize / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

    return (
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ring.trackColor}
          strokeOpacity={ring.trackOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ring.fillColor}
          strokeOpacity={ring.fillOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
    );
  }

  // Rounded rectangle path
  // Parse border-radius: could be "22%", "30px", etc.
  let cornerRadius: number;
  if (borderRadius.endsWith("%")) {
    cornerRadius = (parseFloat(borderRadius) / 100) * innerSize;
  } else {
    cornerRadius = parseFloat(borderRadius) || 0;
  }

  const d = roundedRectPath(inset, inset, innerSize, innerSize, cornerRadius);

  // Calculate path length for dash animation
  const straightH = Math.max(0, innerSize - 2 * cornerRadius);
  const straightV = Math.max(0, innerSize - 2 * cornerRadius);
  const arcLen = (2 * Math.PI * cornerRadius) / 4;
  const pathLength = 2 * straightH + 2 * straightV + 4 * arcLen;
  const offset = pathLength * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <svg width={size} height={size} className="absolute inset-0">
      {/* Track */}
      <path
        d={d}
        fill="none"
        stroke={ring.trackColor}
        strokeOpacity={ring.trackOpacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Progress fill */}
      <path
        d={d}
        fill="none"
        stroke={ring.fillColor}
        strokeOpacity={ring.fillOpacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.3s ease" }}
      />
    </svg>
  );
}

export function TimerDisplay({
  config,
  state,
  totalDuration,
}: {
  config: TimerConfig;
  state: TimerState;
  totalDuration?: number;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (state.status === "paused" && state.pausedWithRemaining != null) {
      setRemaining(state.pausedWithRemaining);
      return;
    }

    if (!state.targetEndTime) {
      setRemaining(0);
      return;
    }

    const target = new Date(state.targetEndTime).getTime();

    function tick() {
      const now = Date.now();
      setRemaining(Math.max(0, target - now));
    }

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [state.targetEndTime, state.pausedWithRemaining, state.status]);

  const { hours, minutes, seconds } = formatTime(remaining, config.showHours);
  const timeDisplay = config.showHours
    ? `${hours}:${minutes}:${seconds}`
    : `${minutes}:${seconds}`;

  const textShadow =
    config.text.outlineSize !== "0px"
      ? `0 0 ${config.text.outlineSize} ${config.text.outlineColor}`
      : "none";

  const label = config.labels[state.status] ?? state.status;

  if (state.status === "idle") {
    return null;
  }

  // Calculate progress for the ring
  const total = totalDuration ?? STATUS_DURATIONS[state.status] ?? 25 * 60 * 1000;
  const progress = total > 0 ? remaining / total : 0;

  // Parse size for SVG ring
  const size = parseInt(config.dimensions.width) || 250;

  // Check if ring config exists (backward compat)
  const ring = config.ring ?? {
    enabled: true,
    trackColor: "#ffffff",
    trackOpacity: 0.15,
    fillColor: "#ffffff",
    fillOpacity: 0.9,
    width: 8,
    gap: 4,
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{
        width: config.dimensions.width,
        height: config.dimensions.height,
        backgroundColor: `${config.background.color}${toHexOpacity(config.background.opacity)}`,
        borderRadius: config.background.borderRadius,
        fontFamily: config.text.fontFamily,
      }}
    >
      {ring.enabled && (
        <ProgressRing
          progress={progress}
          size={size}
          ring={ring}
          borderRadius={config.background.borderRadius}
        />
      )}

      <span
        className="relative font-medium uppercase tracking-widest"
        style={{
          fontSize: config.fontSizes.label,
          color: config.text.color,
          textShadow,
          letterSpacing: "0.15em",
        }}
      >
        {label}
      </span>

      <span
        className="relative font-bold tabular-nums"
        style={{
          fontSize: config.fontSizes.time,
          color: config.text.color,
          textShadow,
          lineHeight: 1.1,
        }}
      >
        {timeDisplay}
      </span>

      <span
        className="relative font-medium"
        style={{
          fontSize: config.fontSizes.cycle,
          color: config.text.color,
          opacity: 0.6,
        }}
      >
        {state.currentCycle}/{state.totalCycles}
      </span>
    </div>
  );
}
