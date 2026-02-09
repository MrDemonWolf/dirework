"use client";

import { useEffect, useState } from "react";

interface TimerConfig {
  dimensions: { width: string; height: string };
  background: { color: string; opacity: number; borderRadius: string };
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

export function TimerDisplay({
  config,
  state,
}: {
  config: TimerConfig;
  state: TimerState;
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

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        width: config.dimensions.width,
        height: config.dimensions.height,
        backgroundColor: `${config.background.color}${toHexOpacity(config.background.opacity)}`,
        borderRadius: config.background.borderRadius,
        fontFamily: config.text.fontFamily,
      }}
    >
      <span
        className="font-medium uppercase tracking-wide"
        style={{
          fontSize: config.fontSizes.label,
          color: config.text.color,
          textShadow,
        }}
      >
        {label}
      </span>

      <span
        className="font-bold tabular-nums"
        style={{
          fontSize: config.fontSizes.time,
          color: config.text.color,
          textShadow,
        }}
      >
        {timeDisplay}
      </span>

      <span
        className="font-medium"
        style={{
          fontSize: config.fontSizes.cycle,
          color: config.text.color,
        }}
      >
        {state.currentCycle}/{state.totalCycles}
      </span>
    </div>
  );
}
