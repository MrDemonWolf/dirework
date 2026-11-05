import { useEffect } from "react";

import { deployReloader } from "./deploy-reload";

/**
 * An overlay's hook into lib/deploy-reload.ts: after each poll answer (`answeredAt`, React
 * Query's `dataUpdatedAt`), reload the page once a deploy is live, when `safe`. Adds no
 * request: the answer already carried the api's build id, and `/version.json` (a static
 * asset) is asked only while that id differs from this page's.
 */
export function useReloadAfterDeploy(answeredAt: number, safe: boolean): void {
  useEffect(() => {
    if (answeredAt === 0) return;
    void deployReloader()?.check(() => safe);
  }, [answeredAt, safe]);
}
