"use client";

import { useQuery } from "@tanstack/react-query";

import { StatusChip, type StatusTone } from "@/components/status-chip";
import { trpc } from "@/utils/trpc";

const statusConfig: Record<string, { label: string; tone: StatusTone; pulse: boolean }> = {
  idle: { label: "Ready", tone: "idle", pulse: false },
  starting: { label: "Starting", tone: "accent", pulse: true },
  work: { label: "Focusing", tone: "accent", pulse: true },
  break: { label: "On Break", tone: "live", pulse: true },
  longBreak: { label: "On Break", tone: "live", pulse: true },
  paused: { label: "Paused", tone: "warn", pulse: false },
  finished: { label: "Finished", tone: "live", pulse: false },
};

export function TimerStatusBadge() {
  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 1000,
  });

  const status = timer.data?.status ?? "idle";
  const config = statusConfig[status] ?? statusConfig.idle;

  return <StatusChip tone={config.tone} label={config.label} pulse={config.pulse} />;
}
