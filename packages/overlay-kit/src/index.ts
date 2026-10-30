/**
 * @dirework/overlay-kit — pure geometry + formatting helpers, the brand copy and
 * the demo session shared by the real OBS overlays (apps/web), the docs-site
 * mocks (apps/fumadocs) and both apps' share cards.
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
 * Format milliseconds as a countdown clock. Under an hour it is "MM:SS"; from
 * 60 minutes up it is "H:MM:SS" (a 24-hour focus reads "24:00:00", never
 * "1440:00"). `showHours` (the timer config's "Show hours" switch) forces the
 * zero-padded "HH:MM:SS" form at every length. Negative and non-finite values
 * clamp to zero; partial seconds round up.
 */
export function formatClock(ms: number, showHours = false): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  if (showHours) return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** The cycle counter as the timer overlay and its mocks print it: "Cycle 2 / 4". */
export function cycleLabel(current: number, total: number): string {
  return `Cycle ${current} / ${total}`;
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

// ── Brand copy ───────────────────────────────────────────────────────────────

const BRAND_NAME = "DireWork";
const BRAND_TAGLINE = "A focus timer for your Twitch stream";

/**
 * The one tagline every surface uses — docs hero and <title>, the web app's
 * metadata, both share cards — so the copy can't drift between the apps.
 */
export const BRAND = {
  name: BRAND_NAME,
  /** No trailing period: the hero H1 adds one, titles and cards use it bare. */
  tagline: BRAND_TAGLINE,
  /** Default document title and share-card alt text. */
  title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
  /** The sentence under the tagline: hero subheadline, meta description, cards. */
  description:
    "Run Pomodoro sessions, show shared tasks, and let viewers join from chat. One DireWork per channel, on your own Cloudflare account.",
} as const;

// ── Demo session ─────────────────────────────────────────────────────────────
// One fictional co-working session that every mock renders — the docs hero
// scene and overlay previews, the share cards, the web landing — so the
// numbers, names and bot replies agree everywhere.

export type DemoTaskStatus = "active" | "pending" | "done";

export interface DemoTask {
  /** Twitch display name of the viewer who added it. */
  author: string;
  text: string;
  status: DemoTaskStatus;
}

/**
 * The default bot reply a demo line is built from: a key of DEFAULT_TASK_MESSAGES or
 * DEFAULT_TIMER_MESSAGES in packages/db/src/defaults.ts. This package has no
 * dependencies, so the reply text is spelled out in {@link DEMO_SESSION} and
 * apps/web's demo-session test holds it to `interpolate(DEFAULT_*[key], vars)`.
 */
export type DemoReplyTemplate =
  | { group: "task"; key: "taskAdded" | "taskDone" | "noTask" }
  | { group: "timer"; key: "eta" };

export type DemoChatLine =
  | { kind: "command"; user: string; text: string }
  | {
      kind: "reply";
      template: DemoReplyTemplate;
      /** The `{placeholder}` values the bot filled the template with. */
      vars: Readonly<Record<string, string>>;
      text: string;
    };

export interface DemoSession {
  /** Phase label as the timer overlay shows it. */
  phaseLabel: string;
  /** Length of the running focus block — the default 25:00 work duration. */
  phaseMs: number;
  /** Time left in the block (18:24), so the ring reads as mid-session. */
  remainingMs: number;
  cycle: { current: number; total: number };
  /** In list order; viewers' tasks are grouped by author when rendered. */
  tasks: readonly DemoTask[];
  /** A scripted exchange: real commands, answered with the real default replies. */
  chat: readonly DemoChatLine[];
}

export const DEMO_SESSION: DemoSession = {
  phaseLabel: "Focus",
  phaseMs: 25 * 60_000,
  remainingMs: 18 * 60_000 + 24_000,
  cycle: { current: 2, total: 4 },
  // The app keeps one active task per viewer (the first open task is activated,
  // finishing it promotes the next), so every viewer with open tasks has one.
  tasks: [
    {
      author: "ada_codes",
      text: "Write the migration tests for the new task table and get them passing on CI",
      status: "active",
    },
    { author: "ada_codes", text: "Review the overlay pull request", status: "pending" },
    { author: "pixel_pat", text: "Sketch three logo concepts", status: "active" },
    { author: "night_owl", text: "Read one chapter", status: "done" },
  ],
  // night_owl arrives with no task, adds one and finishes it; a mod checks the
  // timer (`!timer` is broadcaster/mod only). Each reply is the default template
  // filled exactly as the bot does it.
  chat: [
    { kind: "command", user: "night_owl", text: "!today" },
    {
      kind: "reply",
      template: { group: "task", key: "noTask" },
      vars: { user: "night_owl" },
      text: "You don't have a task yet, night_owl. Start one with !task [task].",
    },
    { kind: "command", user: "night_owl", text: "!task Read one chapter" },
    {
      kind: "reply",
      template: { group: "task", key: "taskAdded" },
      vars: { user: "night_owl", task: "Read one chapter" },
      text: 'Added "Read one chapter" to the pack, night_owl.',
    },
    { kind: "command", user: "night_owl", text: "!done" },
    {
      kind: "reply",
      template: { group: "task", key: "taskDone" },
      vars: { user: "night_owl", task: "Read one chapter" },
      text: 'Nice work, night_owl. "Read one chapter" is done.',
    },
    { kind: "command", user: "den_mod", text: "!timer eta" },
    {
      // 18:24 left in focus block 2 of 4, then break 5 + focus 25 + break 5 +
      // focus 25 with no break after the last block (the default timer config):
      // 78:24, which the bot rounds up to whole minutes.
      kind: "reply",
      template: { group: "timer", key: "eta" },
      vars: { phase: "19m", time: "1h 19m" },
      text: "This phase ends in 19m · the session ends in 1h 19m",
    },
  ],
};
