"use client";

import {
  TIMER_CONFIG_DEFAULTS,
  type PhaseLabelsConfig,
  type TimerStylesConfig,
} from "@/lib/config-types";
import {
  type TimerState,
  colorWithOpacity,
  cssLengthToPx,
  formatTime,
  quoteFontFamily,
  resolvePhaseDuration,
  roundedRectPath,
  roundedRectPerimeter,
} from "@/lib/timer-utils";
import { useTimerCountdown } from "@/lib/use-timer-countdown";

// Style shape comes from the shared config source of truth (audit M4);
// the overlay payload composes it with runtime labels + showHours.
type RingConfig = TimerStylesConfig["ring"];

type TimerConfig = TimerStylesConfig & {
  labels: PhaseLabelsConfig;
  showHours: boolean;
};

// The countdown ticks once per displayed second; a matching linear transition
// glides the ring between ticks instead of restarting an ease every frame.
const RING_TRANSITION = "stroke-dashoffset 1s linear";

function ProgressRing({
  progress,
  width,
  height,
  ring,
  borderRadius,
}: {
  progress: number;
  width: number;
  height: number;
  ring: RingConfig;
  borderRadius: string;
}) {
  const strokeWidth = ring.width;
  const gap = ring.gap;
  const inset = strokeWidth / 2 + gap;
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  // Too small to fit the stroke + gap: nothing sensible to draw.
  if (innerWidth <= 0 || innerHeight <= 0) return null;

  // Determine if we should draw a circle or rounded rect
  const isCircle = borderRadius === "50%" || borderRadius === "50";

  if (isCircle) {
    // A circle fits the shorter side and sits centered in non-square boxes.
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

    return (
      <svg
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        <title>Timer progress ring</title>
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radius}
          fill="none"
          stroke={ring.trackColor}
          strokeOpacity={ring.trackOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <circle
          cx={width / 2}
          cy={height / 2}
          r={radius}
          fill="none"
          stroke={ring.fillColor}
          strokeOpacity={ring.fillOpacity}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: RING_TRANSITION }}
        />
      </svg>
    );
  }

  // Rounded rectangle path
  // Parse border-radius: could be "22%", "30px", "1rem" or a multi-value
  // shorthand (the first corner is used).
  const firstRadius = borderRadius.trim().split(/\s+/)[0] ?? "";
  const cornerRadius = firstRadius.endsWith("%")
    ? (Number.parseFloat(firstRadius) / 100) * Math.min(innerWidth, innerHeight)
    : (cssLengthToPx(firstRadius) ?? 0);

  const d = roundedRectPath(inset, inset, innerWidth, innerHeight, cornerRadius);

  // Calculate path length for dash animation
  const pathLength = roundedRectPerimeter(innerWidth, innerHeight, cornerRadius);
  const offset = pathLength * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <svg width={width} height={height} className="absolute inset-0">
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
        style={{ transition: RING_TRANSITION }}
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

  const label = config.labels[state.status];

  // Calculate progress for the ring — a paused timer measures against the
  // phase it froze in, not the "paused" status itself (resolvePhaseDuration owns
  // that branch). Without a caller-provided totalDuration, fall back to the
  // canonical phase defaults. Idle shows a full ring.
  const total =
    totalDuration ??
    resolvePhaseDuration(state.status, state.pausedFromStatus, TIMER_CONFIG_DEFAULTS) ??
    TIMER_CONFIG_DEFAULTS.workDuration;
  const progress = isIdle ? 1 : total > 0 ? remaining / total : 0;

  // SVG ring geometry needs px. Layout-relative sizes (%, vw/vh) can't be
  // resolved without measuring, so the ring is skipped rather than misdrawn.
  const ringWidth = cssLengthToPx(config.dimensions.width);
  const ringHeight = cssLengthToPx(config.dimensions.height);

  const ring = config.ring;

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{
        width: config.dimensions.width,
        height: config.dimensions.height,
        backgroundColor: colorWithOpacity(config.background.color, config.background.opacity),
        borderRadius: config.background.borderRadius,
        fontFamily: quoteFontFamily(config.text.fontFamily),
      }}
    >
      {ring.enabled && ringWidth !== null && ringHeight !== null && (
        <ProgressRing
          progress={progress}
          width={ringWidth}
          height={ringHeight}
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
