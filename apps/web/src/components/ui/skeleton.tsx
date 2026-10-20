import { cn } from "@/lib/utils";

/**
 * Loading placeholder block. A soft highlight sweeps across it (`skeleton-shimmer`,
 * index.css) instead of the stock opacity pulse: one directional motion shared by every
 * block on the page reads as "loading", where a dozen blocks pulsing reads as flicker.
 * The global reduced-motion gate stops the sweep.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer bg-muted rounded-xl", className)}
      {...props}
    />
  );
}

export { Skeleton };
