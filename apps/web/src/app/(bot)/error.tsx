"use client";

// Error boundary for the /bot/<token> page. Auto-resets so an unattended widget, dock or
// pinned tab recovers without anyone clicking. The blank widget sits on a stream, so there
// it paints nothing (only screen readers hear it); the dock shows the notice. The reset
// remounts the console, which claims the chat lease again under this page load's id
// (pageLeaseId), so the bot goes straight back on chat instead of standing by for the lease
// its crashed session still holds. The crash is reported by its name only, with the page's
// bot token, direct to the api (lib/crash-report.ts): at most once per 10 minutes, since
// nobody may be watching.

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { botCrashSurface, createCrashReporter } from "@/lib/crash-report";
import { parseBotView } from "@/lib/bot-view";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { publicTrpc } from "@/utils/public-trpc";

/** The bot is usually unattended, so it restarts on its own. */
const RESTART_AFTER_MS = 10_000;

/** One reporter per bot page: module scope survives the restarts, so the cap holds. */
const reportCrash = createCrashReporter((input) => publicTrpc.crash.report.mutate(input));

/** Remounts the bot route after `RESTART_AFTER_MS`; "Restart now" resets immediately. */
export default function BotError({ error, reset }: { error: Error; reset: () => void }) {
  const view = parseBotView(useSearchParams().get("view") ?? undefined);
  const surface = botCrashSurface(view);
  const { token } = useParams<{ token?: string }>();

  useEffect(() => {
    reportCrash(surface, token, error);
  }, [surface, token, error]);

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
