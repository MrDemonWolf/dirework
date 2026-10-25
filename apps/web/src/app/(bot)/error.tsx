"use client";

// Error boundary for the /bot/<token> console. Auto-resets so an unattended OBS source or
// pinned tab recovers without anyone clicking.

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";

/** The bot is usually unattended (OBS source), so it restarts on its own. */
const RESTART_AFTER_MS = 10_000;

/** Remounts the bot route after `RESTART_AFTER_MS`; "Restart now" resets immediately. */
export default function BotError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const timer = setTimeout(reset, RESTART_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <main className="bot-notice">
      <StatusChip tone="danger" label="Restarting" />
      <h1 className="font-mono text-xl font-semibold">Bot crashed</h1>
      <p role="status">The bot console hit an error and restarts in {RESTART_AFTER_MS / 1000}s.</p>
      <Button type="button" onClick={reset} variant="outline" className="min-h-11">
        Restart now
      </Button>
    </main>
  );
}
