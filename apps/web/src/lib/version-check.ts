// When an open (app) tab looks for a newer deploy. VersionBadge compares the SHA baked into
// this tab with the one `/api/version` reports, and that route is no-store, so every check is
// one web-Worker request. The (app) layout turns checking on for the signed-in owner only;
// here it runs only while the tab is visible, at most once per VERSION_CHECK_MS (a return to
// the tab checks only once that much has passed since the last check), and never again once a
// newer deploy is found (the Reload chip is already showing). A hidden tab holds no timer at
// all, just the visibility listener. React-free, so it is tested with fake timers, like
// lib/bot-presence.ts.

import { VERSION_CHECK_MS } from "./poll-intervals";
import { isStale } from "./version";

/** The SHA the web Worker serves now, or undefined when the check failed (offline, a 5xx). */
export async function fetchDeployedSha(): Promise<string | undefined> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return undefined;
    return ((await res.json()) as { sha?: string }).sha;
  } catch {
    return undefined;
  }
}

export interface VersionCheckOptions {
  /** The SHA this tab was built from. */
  sha: string;
  /** Called once, when a newer deploy is live; no check runs after it. */
  onStale: () => void;
  fetchVersion?: () => Promise<string | undefined>;
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  now?: () => number;
}

/**
 * Check for a newer deploy every VERSION_CHECK_MS while the tab is visible. Returns the
 * cleanup. The page load counts as the first check: the server rendered this tab from the
 * SHA that was live then. A failed check (offline, a 5xx) changes nothing; the next one runs
 * on the cadence.
 */
export function scheduleVersionCheck({
  sha,
  onStale,
  fetchVersion = fetchDeployedSha,
  doc = document,
  now = Date.now,
}: VersionCheckOptions): () => void {
  let lastCheckAt = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function stop(): void {
    stopped = true;
    clearTimeout(timer);
    timer = undefined;
    doc.removeEventListener("visibilitychange", onVisibilityChange);
  }

  async function check(): Promise<void> {
    lastCheckAt = now();
    timer = setTimeout(tick, VERSION_CHECK_MS);
    const live = await fetchVersion().catch(() => undefined);
    if (stopped || !isStale(sha, live)) return;
    stop();
    onStale();
  }

  // A tick that finds the tab hidden arms nothing: coming back to the tab runs it again.
  function tick(): void {
    timer = undefined;
    if (stopped || doc.visibilityState !== "visible") return;
    const wait = lastCheckAt + VERSION_CHECK_MS - now();
    if (wait > 0) timer = setTimeout(tick, wait);
    else void check();
  }

  // A pending timer already fires on time; only a tick skipped while hidden needs this.
  function onVisibilityChange(): void {
    if (doc.visibilityState === "visible" && timer === undefined) tick();
  }

  doc.addEventListener("visibilitychange", onVisibilityChange);
  tick();
  return stop;
}
