// The capped crash report the overlay and bot error boundaries send
// (docs/decisions/0003-client-observability.md). Pure (no tRPC import) so the cap is tested with
// fake timers; each boundary builds its one reporter over `publicTrpc.crash.report`.
//
// Cost: nothing while a page is healthy (only a crash calls it). A page stuck in a crash loop
// re-mounts every 10s but sends at most one report per CRASH_REPORT_INTERVAL_MS: ≤144 Worker
// requests and ≤144 primary-key token reads a day, and no D1 write.

import {
  CRASH_NAME_PATTERN,
  CRASH_REPORT_INTERVAL_MS,
  type CrashSurface,
} from "@dirework/api/crash-report";

import type { BotView } from "@/lib/bot-view";

export { CRASH_REPORT_INTERVAL_MS };
export type { CrashSurface };

export interface CrashReportInput {
  token: string;
  surface: CrashSurface;
  name: string;
}

/**
 * The error's constructor name when it is a safe token (TypeError, ChunkLoadError), else
 * "Error". Never the message, stack or digest: those can carry task text or a URL.
 */
export function crashName(error: unknown): string {
  const name = error instanceof Error ? error.name : undefined;
  return typeof name === "string" && CRASH_NAME_PATTERN.test(name) ? name : "Error";
}

/** Which overlay crashed, from its path (`/overlay/t/<token>` or `/overlay/l/<token>`). */
export function overlayCrashSurface(pathname: string | null): CrashSurface | null {
  if (pathname?.startsWith("/overlay/t/")) return "overlay_timer";
  if (pathname?.startsWith("/overlay/l/")) return "overlay_tasks";
  return null;
}

/** The bot page's surface for its view (`parseBotView`). */
export function botCrashSurface(view: BotView): CrashSurface {
  return view === "dock" ? "bot_dock" : "bot_widget";
}

/**
 * A reporter for one page: the first crash sends at once (a crashed page doesn't poll, so
 * nothing else would carry it), and later ones inside the window are dropped. Fire-and-forget:
 * a failed send is swallowed, since nothing on a stream may show it. Returns whether it sent.
 * Make one per page at module scope: the boundary re-mounts on every crash, the module doesn't.
 */
export function createCrashReporter(send: (input: CrashReportInput) => Promise<unknown>) {
  let lastSentAt: number | null = null;
  return (surface: CrashSurface | null, token: string | undefined, error: unknown): boolean => {
    if (!surface || !token) return false;
    const now = Date.now();
    if (lastSentAt !== null && now - lastSentAt < CRASH_REPORT_INTERVAL_MS) return false;
    lastSentAt = now;
    send({ token, surface, name: crashName(error) }).catch(() => {});
    return true;
  };
}
