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
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  w = Math.max(0, w);
  h = Math.max(0, h);
  // A degenerate rect has no outline to stroke (and would emit negative arcs).
  if (w === 0 || h === 0) return "";
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
  w = Math.max(0, w);
  h = Math.max(0, h);
  if (w === 0 || h === 0) return 0;
  r = clampRadius(w, h, r);
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

/**
 * Format milliseconds as a "MM:SS" clock string (minutes can exceed 99).
 * Negative and non-finite values clamp to "00:00"; partial seconds round up.
 */
export function formatClock(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Convert a CSS length to px for SVG geometry. Handles px, unitless, pt and
 * rem/em (at the 16px default font size the overlays render with). Returns null
 * for units whose size depends on layout (%, vw/vh, ch) — a correctly sized
 * ring can't be drawn from those without measuring.
 */
export function cssLengthToPx(value: string, rootFontSize = 16): number | null {
  const match = /^\s*([+-]?\d+(?:\.\d+)?)\s*(px|pt|r?em)?\s*$/i.exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  switch (match[2]?.toLowerCase()) {
    case "pt":
      return (n * 4) / 3;
    case "rem":
    case "em":
      return n * rootFontSize;
    default:
      return n;
  }
}

/** CSS generic families and keywords — must stay unquoted to keep their meaning. */
const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

/**
 * Turn a stored font-family list into a valid CSS value. Named families are
 * double-quoted, because an unquoted name with a digit-led word ("Source Sans 3")
 * is invalid CSS and the browser drops the whole declaration. Generic families
 * stay bare. Safe to interpolate: the config schema forbids double quotes.
 */
export function quoteFontFamily(value: string): string {
  return value
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/^'(.*)'$/, "$1")
        .trim(),
    )
    .filter(Boolean)
    .map((part) => (GENERIC_FONT_FAMILIES.has(part.toLowerCase()) ? part : `"${part}"`))
    .join(", ");
}
