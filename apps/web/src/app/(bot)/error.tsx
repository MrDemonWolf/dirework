"use client";

// Error boundary for the /bot/<token> page. Auto-resets so an unattended widget, dock or
// pinned tab recovers without anyone clicking. The blank widget sits on a stream, so there
// it paints nothing (only screen readers hear it); the dock shows the notice.

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { parseBotView } from "@/lib/bot-view";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";

/** The bot is usually unattended, so it restarts on its own. */
const RESTART_AFTER_MS = 10_000;

/** Remounts the bot route after `RESTART_AFTER_MS`; "Restart now" resets immediately. */
export default function BotError({ reset }: { error: Error; reset: () => void }) {
  const view = parseBotView(useSearchParams().get("view") ?? undefined);

  useEffect(() => {
    const timer = setTimeout(reset, RESTART_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);

  if (view === "widget") {
    return (
      <p role="status" className="sr-only">
        {`DireWork bot crashed and restarts in ${RESTART_AFTER_MS / 1000}s.`}
      </p>
    );
  }

  return (
    <main className="bot-notice">
      <StatusChip tone="danger" label="Restarting" />
      <h1 className="font-mono text-xl font-semibold">Bot crashed</h1>
      <p role="status">The bot hit an error and restarts in {RESTART_AFTER_MS / 1000}s.</p>
      <Button type="button" onClick={reset} variant="outline" className="min-h-11">
        Restart now
      </Button>
    </main>
  );
}
