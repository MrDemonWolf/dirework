"use client";

// LED-style status chip used across the app (timer state, bot connection, unsaved changes).

import { cn } from "@/lib/utils";

/**
 * Semantic tones: live = connected/running (emerald), warn = paused/unsaved (amber),
 * accent = cerulean primary, alt = cornflower secondary, idle = neutral,
 * danger = destructive.
 */
export type StatusTone = "live" | "warn" | "accent" | "alt" | "idle" | "danger";

const toneStyles: Record<StatusTone, { chip: string; dot: string }> = {
  live: { chip: "border-success/30 bg-success/10 text-success", dot: "bg-success" },
  warn: { chip: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning" },
  accent: { chip: "border-primary/30 bg-primary/10 text-link", dot: "bg-primary" },
  alt: { chip: "border-cornflower/30 bg-cornflower/10 text-cornflower", dot: "bg-cornflower" },
  idle: {
    chip: "border-border bg-muted/60 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  danger: {
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

/**
 * LED-style status chip — small indicator dot + mono uppercase label.
 * The signature status element of the Focus Console design language.
 * Pulse is opt-in and globally disabled under prefers-reduced-motion.
 */
export function StatusChip({
  tone = "idle",
  label,
  pulse = false,
  size = "default",
  dot = "solid",
  title,
  className,
}: {
  tone?: StatusTone;
  label: string;
  pulse?: boolean;
  size?: "default" | "sm";
  /** `half`: a half-filled ring in the label color (◐) for "under way, not in focus". */
  dot?: "solid" | "half";
  /** Full text on hover, for a label that may be cut (a streamer's custom phase label). */
  title?: string;
  className?: string;
}) {
  const styles = toneStyles[tone];
  // Never shrinks below its label in a row (neighbours truncate first), but never grows wider
  // than its row either (max-w-full): a long label then ends in an ellipsis.
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border font-mono text-2xs font-medium tracking-chip uppercase",
        size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1",
        styles.chip,
        className,
      )}
    >
      {dot === "half" ? (
        // A half-lit LED (◐): under way but not the one in focus.
        <span
          aria-hidden
          className="relative size-2 shrink-0 overflow-hidden rounded-full border border-current"
        >
          <span className="absolute inset-y-0 left-0 w-1/2 bg-current" />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", styles.dot, pulse && "animate-led-pulse")}
        />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
