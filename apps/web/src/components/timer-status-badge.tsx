"use client";

import { useQuery } from "@tanstack/react-query";

import { StatusChip } from "@/components/status-chip";
import { TIMER_TONES, toTimerStatus, type TimerStatus } from "@/lib/status-tones";
import { trpc } from "@/utils/trpc";

const statusLabels: Record<TimerStatus, string> = {
  idle: "Ready",
  starting: "Starting",
  work: "Focusing",
  break: "On Break",
  longBreak: "On Break",
  paused: "Paused",
  finished: "Finished",
};

export function TimerStatusBadge() {
  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 1000,
  });

  const status: TimerStatus = toTimerStatus(timer.data?.status ?? "idle");
  const { tone, pulse } = TIMER_TONES[status];

  return <StatusChip tone={tone} label={statusLabels[status]} pulse={pulse} />;
}
