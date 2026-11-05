/**
 * The crash report's shared vocabulary (docs/decisions/0003-client-observability.md). Zod-free,
 * so the overlay and bot pages' error boundaries import it without bundling zod; the
 * `crash.report` input schema reads the same constants.
 *
 * A report carries nothing but a surface from this closed list and the error's NAME (never
 * its message, stack, component stack or the URL), and is logged as one `client.crash`
 * metric with the label `<surface>:<name>`.
 */

/**
 * The pages that report: the two OBS overlays and the two views of the bot page. Each is
 * token-gated, so a report proves itself with the page's own token. The dashboard sends
 * nothing (the owner is looking at it, and its pages carry no token to gate a public call).
 */
export const CRASH_SURFACES = ["overlay_timer", "overlay_tasks", "bot_widget", "bot_dock"] as const;

export type CrashSurface = (typeof CRASH_SURFACES)[number];

/** A page sends at most one report per this window, however often it crashes. */
export const CRASH_REPORT_INTERVAL_MS = 10 * 60 * 1000;

/** Telemetry's label pattern caps a label at 40 characters (apps/server/src/lib/telemetry.ts). */
const LABEL_MAX = 40;
const LONGEST_SURFACE = Math.max(...CRASH_SURFACES.map((surface) => surface.length));

/** Longest error name that still fits `<surface>:<name>` inside a telemetry label. */
export const CRASH_NAME_MAX_LENGTH = LABEL_MAX - LONGEST_SURFACE - 1;

/**
 * Telemetry's safe-token character class, at the length that keeps the label whole. A
 * message ("Cannot read properties of undefined") has spaces, a URL has `/` and `?`, so
 * neither can pass as a name.
 */
export const CRASH_NAME_PATTERN = new RegExp(`^[a-z0-9_.:-]{1,${CRASH_NAME_MAX_LENGTH}}$`, "i");

/** The `client.crash` metric label for one report. */
export function crashLabel(surface: CrashSurface, name: string): string {
  return `${surface}:${name}`;
}
