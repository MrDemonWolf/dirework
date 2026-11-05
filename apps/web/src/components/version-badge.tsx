"use client";

import { useEffect, useState } from "react";

import { statusChipClassName } from "@/components/status-chip";
import { scheduleVersionCheck } from "@/lib/version-check";

const REPO = "https://github.com/mrdemonwolf/dirework";

/**
 * Footer deploy readout: `· <short sha>`, linked to the commit on GitHub. Every
 * deploy is one commit, so the SHA is the version that matters (there is no
 * separate version number).
 *
 * With `checkForUpdates` (the (app) layout sets it for the signed-in owner only),
 * it asks /version.json for the SHA the deployed static assets are serving, every
 * VERSION_CHECK_MS while the tab is visible (lib/version-check.ts). Once that no
 * longer matches the SHA baked into this tab, a newer deploy shipped and this tab
 * is stale: it offers a Reload and stops checking. Without it (viewers on / and
 * /setup) the badge is static and makes no request.
 */
export function VersionBadge({
  sha,
  checkForUpdates = false,
}: {
  sha?: string;
  checkForUpdates?: boolean;
}) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!checkForUpdates || !sha || sha === "dev") return;
    return scheduleVersionCheck({ sha, onStale: () => setStale(true) });
  }, [sha, checkForUpdates]);

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
          className={`${statusChipClassName({ tone: "warn", size: "sm" })} transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
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
