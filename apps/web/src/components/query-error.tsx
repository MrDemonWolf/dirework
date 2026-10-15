"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { cn } from "@/lib/utils";

/**
 * Inline failed-load state. Render it only when a query has NO data — a failed
 * background refetch keeps the last payload, and tearing down a populated
 * editor (with unsaved edits) over one blip would be worse than stale data.
 */
export function QueryError({
  title,
  onRetry,
  retrying = false,
  className,
}: {
  title: string;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <Callout title={title}>Check your connection, then try again.</Callout>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={cn("size-3.5", retrying && "animate-spin")} />
        Retry
      </Button>
    </div>
  );
}
