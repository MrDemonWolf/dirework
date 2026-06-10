"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <div className="container mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="rounded-2xl bg-destructive/10 p-3.5">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div>
        <h2 className="font-heading text-lg font-semibold">Something broke on the dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your timer and overlays keep running on the server — this is just a display hiccup.
        </p>
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        <RotateCcw className="mr-1.5 size-3.5" />
        Try again
      </Button>
    </div>
  );
}
