import type { StatusTone } from "@/components/status-chip";

export type TimerStatus =
  | "idle" | "starting" | "work" | "break" | "longBreak" | "paused" | "finished";

/** phase → chip tone + pulse. Pulse ONLY while time is actually elapsing. */
export const TIMER_TONES: Record<TimerStatus, { tone: StatusTone; pulse: boolean }> = {
  idle:      { tone: "idle",   pulse: false },
  starting:  { tone: "accent", pulse: true  },
  work:      { tone: "live",   pulse: true  },   // emerald = ON AIR
  break:     { tone: "accent", pulse: true  },   // cerulean
  longBreak: { tone: "alt",    pulse: true  },   // cornflower (new tone)
  paused:    { tone: "warn",   pulse: false },   // amber, frozen — no pulse
  finished:  { tone: "alt",    pulse: false },
};

/** phase → CSS color var for ambient ring/rail/glow (tokens only). */
export const TIMER_PHASE_COLOR: Record<TimerStatus, string> = {
  idle: "var(--muted-foreground)",
  starting: "var(--primary)",
  work: "var(--success)",
  break: "var(--primary)",
  longBreak: "var(--chart-2)",
  paused: "var(--warning)",
  finished: "var(--chart-2)",
};
