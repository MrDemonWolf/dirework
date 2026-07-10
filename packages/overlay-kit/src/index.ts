/**
 * @dirework/overlay-kit — pure geometry + formatting helpers shared by the
 * real OBS overlays (apps/web) and the docs-site overlay mocks (apps/fumadocs).
 *
 * Zero runtime dependencies. No `@dirework/env` imports (Vitest runs in Node
 * and cannot resolve `cloudflare:workers`).
 */

/**
 * Squircle corner radius as a fraction of the overlay's size.
 * Canonical value — `design-system/tokens.json` (`overlay.squircleRadius`)
 * must match; a unit test in apps/web asserts the sync.
 */
export const SQUIRCLE_RADIUS = 0.22;

/** Clamp a corner radius so it never exceeds half of either side. */
function clampRadius(w: number, h: number, r: number): number {
  return Math.max(0, Math.min(r, w / 2, h / 2));
}

/**
 * Build a rounded-rectangle SVG path starting from top-center, going clockwise.
 * This gives us a continuous path we can use with strokeDasharray for progress.
 */
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  r = clampRadius(w, h, r);
  // Start at top-center, draw clockwise
  return [
    `M ${x + w / 2} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `Z`,
  ].join(" ");
}

/**
 * Total length of the path produced by {@link roundedRectPath}:
 * four straight segments plus a full circle of the (clamped) corner radius.
 * Use as strokeDasharray / to compute strokeDashoffset for ring progress.
 */
export function roundedRectPerimeter(w: number, h: number, r: number): number {
  r = clampRadius(w, h, r);
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

/**
 * Format milliseconds as a "MM:SS" clock string (minutes can exceed 99).
 * Negative values clamp to "00:00"; partial seconds round up.
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
