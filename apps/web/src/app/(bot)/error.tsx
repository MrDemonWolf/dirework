"use client";

import { useEffect } from "react";

/** The bot is usually unattended (OBS source), so it restarts on its own. */
const RESTART_AFTER_MS = 10_000;

export default function BotError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const timer = setTimeout(reset, RESTART_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center font-mono">
      <h1 className="text-xl font-bold tracking-[0.2em] text-red-400 uppercase">Bot crashed</h1>
      <p role="status" className="max-w-sm text-sm text-zinc-400">
        The bot console hit an error and restarts in {RESTART_AFTER_MS / 1000}s.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:outline-none"
      >
        Restart now
      </button>
    </main>
  );
}
