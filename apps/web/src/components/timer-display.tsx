"use client";

import { TIMER_CONFIG_DEFAULTS, type TimerStylesConfig } from "@/lib/config-types";
import {
  type TimerState,
  toHexOpacity,
  formatTime,
  resolvePhaseDuration,
  roundedRectPath,
  roundedRectPerimeter,
} from "@/lib/timer-utils";
import { useTimerCountdown } from "@/lib/use-timer-countdown";

// Style shape comes from the shared config source of truth (audit M4);
// the overlay payload composes it with runtime labels + showHours.
type RingConfig = TimerStylesConfig["ring"];

type TimerConfig = TimerStylesConfig & {
  labels: Record<string, string>;
  showHours: boolean;
};

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
        <title>Timer progress ring</title>
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
  const pathLength = roundedRectPerimeter(innerSize, innerSize, cornerRadius);
  const offset = pathLength * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <svg width={size} height={size} className="absolute inset-0">
      <title>Timer progress ring</title>
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
  const remaining = useTimerCountdown(state) ?? 0;

  // Idle timer isn't counting — show the configured phase length (fed as
  // totalDuration) so the widget reads full during stream setup instead of
  // blanking out. Previously idle rendered nothing at all.
  const isIdle = state.status === "idle";
  const displayMs = isIdle ? (totalDuration ?? 0) : remaining;

  const { hours, minutes, seconds } = formatTime(displayMs, config.showHours);
  const timeDisplay = config.showHours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;

  const textShadow =
    config.text.outlineSize !== "0px"
      ? `0 0 ${config.text.outlineSize} ${config.text.outlineColor}`
      : "none";

  const label = config.labels[state.status] ?? state.status;

  // Calculate progress for the ring — a paused timer measures against the
  // phase it froze in, not the "paused" status itself (resolvePhaseDuration owns
  // that branch). Without a caller-provided totalDuration, fall back to the
  // canonical phase defaults. Idle shows a full ring.
  const total =
    totalDuration ??
    resolvePhaseDuration(state.status, state.pausedFromStatus, TIMER_CONFIG_DEFAULTS) ??
    TIMER_CONFIG_DEFAULTS.workDuration;
  const progress = isIdle ? 1 : total > 0 ? remaining / total : 0;

  // Parse size for SVG ring
  const size = parseInt(config.dimensions.width, 10) || 250;

  // Check if ring config exists (backward compat)
  const ring = config.ring ?? {
    enabled: true,
    trackColor: "#ffffff",
    trackOpacity: 0.18,
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
