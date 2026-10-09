"use client";

import type { MessageBudget } from "@/lib/message-budget";
import { cn } from "@/lib/utils";

/**
 * Remaining-bytes readout under a chat-template input. Hidden until the value
 * nears the cap; the input should point at `id` via aria-describedby while it
 * is visible and set aria-invalid when `budget.over`.
 */
export function ByteBudget({ id, budget }: { id: string; budget: MessageBudget }) {
  if (!budget.nearLimit) return null;
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn(
        "text-right font-mono text-xs tabular-nums",
        budget.over ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {budget.bytes}/{budget.max} bytes{budget.over ? " — too long to save" : ""}
    </p>
  );
}
