"use client";

import { useCallback, useEffect, useState } from "react";

import { isStale } from "@/lib/version";

const REPO = "https://github.com/mrdemonwolf/dirework";
// Single streamer, one tab — a 5-min poll is well within the free-tier budget
// and catches a fresh deploy within a few minutes.
const POLL_MS = 5 * 60 * 1000;

/**
 * Footer deploy readout: `· <short sha>`, linked to the commit on GitHub. Every
 * deploy is one commit, so the SHA is the version that matters (there is no
 * separate version number). Polls /api/version for the SHA the web worker is
 * *currently* serving; when it no longer matches the SHA baked into this tab, a
 * newer deploy shipped and this tab is stale — offers a Reload.
 */
export function VersionBadge({ sha }: { sha?: string }) {
  const [stale, setStale] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { sha: live } = (await res.json()) as { sha?: string };
      if (isStale(sha, live)) setStale(true);
    } catch {
      // Offline / transient — leave the current state, try again next tick.
    }
  }, [sha]);

  useEffect(() => {
    if (!sha || sha === "dev") return;
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sha, check]);

  if (!sha) return null;

  return (
    <>
      <span aria-hidden className="text-muted-foreground/50">
        &middot;
      </span>
      {sha === "dev" ? (
        // Local build without git metadata — nothing on GitHub to link to.
        <span className="font-mono">dev</span>
      ) : (
        <a
          href={`${REPO}/commit/${sha}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Deployed commit ${sha} — view on GitHub`}
          className="font-mono transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sha.slice(0, 7)}
        </a>
      )}
      {stale && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.08em] text-warning uppercase transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 animate-led-pulse rounded-full bg-warning"
          />
          New version — Reload
        </button>
      )}
    </>
  );
}
