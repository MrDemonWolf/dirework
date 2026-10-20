import { cn } from "@/lib/utils";

/** Small mono count pill for section headers and rules: how many items sit below. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-muted px-1.5 font-mono text-[10px] tabular-nums text-muted-foreground",
        className,
      )}
    >
      {count}
    </span>
  );
}
