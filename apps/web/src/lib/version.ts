/**
 * True when the deploy currently served (`live`) differs from the SHA this tab
 * was built with (`baked`) — i.e. a newer version shipped and the open tab is
 * running stale code. "dev"/empty SHAs (local, or an unset build var) never
 * count as stale, so local dev doesn't nag a reload.
 */
export function isStale(baked?: string, live?: string): boolean {
  if (!baked || !live || baked === "dev" || live === "dev") return false;
  return baked !== live;
}
