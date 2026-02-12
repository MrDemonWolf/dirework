"use client";

import { useQuery } from "@tanstack/react-query";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

const statusConfig: Record<string, { label: string; className: string; pulse: boolean }> = {
  idle: { label: "Ready", className: "text-muted-foreground", pulse: false },
  starting: { label: "Starting", className: "text-primary", pulse: true },
  work: { label: "Focusing", className: "text-primary", pulse: true },
  break: { label: "On Break", className: "text-emerald-500", pulse: true },
  longBreak: { label: "On Break", className: "text-emerald-500", pulse: true },
  paused: { label: "Paused", className: "text-amber-500", pulse: false },
  finished: { label: "Finished", className: "text-primary", pulse: false },
};

export function TimerStatusBadge() {
  const timer = useQuery({
    ...trpc.timer.get.queryOptions(),
    refetchInterval: 1000,
  });

  const status = timer.data?.status ?? "idle";
  const config = statusConfig[status] ?? statusConfig.idle;

  return (
    <div className={cn("flex items-center gap-1.5 text-sm font-medium", config.className)}>
      <Circle className={cn("size-2.5 fill-current", config.pulse && "animate-pulse")} />
      {config.label}
    </div>
  );
}
