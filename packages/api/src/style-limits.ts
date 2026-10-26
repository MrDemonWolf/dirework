// ── Overlay style and phase label limits (zod-free, schema-free) ─────────────
// One bound per field, read by BOTH the save schemas in ./config-shared (zod) and the
// Theme Center inputs (min/max, arrow stepping, the inline error, the counters), so the
// editor can never accept what the server refuses. Rows saved before a bound existed are
// never migrated: the build* helpers in ./config-shared clamp them on read
// (`clampTimerStyles` / `clampTaskStyles` / `clampPhaseLabel`), so a whole-group save of
// a loaded theme never fails on an old value. Browser-bundled (the overlays import the
// icon ids), so no zod here.

import { TASK_LINES_MAX, TASK_LINES_MIN } from "./config-defaults";
import { graphemes, utf8ByteLength } from "./chat-text";

// ── CSS lengths ──────────────────────────────────────────────────────────────

/**
 * The accepted range of one style length. `px` bounds every absolute unit (rem and em
 * count as 16px, pt as 4/3px); `%` and `vw`/`vh` are accepted only where a range for them
 * is given. Negative values are never in range.
 */
export interface LengthLimit {
  px: readonly [number, number];
  percent?: readonly [number, number];
  viewport?: readonly [number, number];
  /** Space-separated values allowed (padding and radius shorthands take up to 4). Default 1. */
  maxValues?: 1 | 4;
}

const font = (min: number, max: number): LengthLimit => ({ px: [min, max] });
const border: LengthLimit = { px: [0, 12] };
const spacing: LengthLimit = { px: [0, 48] };
const padding: LengthLimit = { px: [0, 48], maxValues: 4 };
const radius = (maxPx: number): LengthLimit => ({ px: [0, maxPx], percent: [0, 50], maxValues: 4 });
const timerSize: LengthLimit = { px: [120, 1200], percent: [10, 100], viewport: [10, 100] };
// The timer's text may follow the OBS source (vw/vh) as well as a fixed px size.
const timerFont = (min: number, max: number): LengthLimit => ({
  px: [min, max],
  viewport: [2, 40],
});

/** Every CSS-length leaf of the timer style config, by dot path. */
export const TIMER_LENGTH_LIMITS = {
  "dimensions.width": timerSize,
  "dimensions.height": timerSize,
  "background.borderRadius": radius(600),
  "text.outlineSize": { px: [0, 6] },
  "fontSizes.label": timerFont(14, 48),
  "fontSizes.time": timerFont(32, 160),
  "fontSizes.cycle": timerFont(12, 48),
} as const satisfies Record<string, LengthLimit>;

/** Every CSS-length leaf of the task style config, by dot path. */
export const TASK_LENGTH_LIMITS = {
  "header.height": { px: [24, 160] },
  "header.border.width": border,
  "header.border.radius": radius(64),
  "header.fontSize": font(16, 72),
  "header.padding": padding,
  "body.border.width": border,
  "body.border.radius": radius(64),
  "body.padding.vertical": spacing,
  "body.padding.horizontal": spacing,
  "task.border.width": border,
  "task.border.radius": radius(64),
  "task.fontSize": font(16, 64),
  "task.padding": padding,
  "task.marginBottom": spacing,
  "task.maxWidth": { px: [100, 2000], percent: [10, 100] },
  "checkbox.size": font(12, 64),
  "checkbox.border.width": border,
  "checkbox.border.radius": radius(32),
  "checkbox.margin.top": spacing,
  "checkbox.margin.left": spacing,
  "checkbox.margin.right": spacing,
  "checkbox.tickSize": font(8, 64),
  "bullet.size": font(12, 64),
  "bullet.margin.top": spacing,
  "bullet.margin.left": spacing,
  "bullet.margin.right": spacing,
} as const satisfies Record<string, LengthLimit>;

/** Integer style fields: [min, max]. */
export const TIMER_NUMBER_LIMITS = {
  "ring.width": [0, 40],
  "ring.gap": [0, 40],
} as const satisfies Record<string, readonly [number, number]>;

export const TASK_NUMBER_LIMITS = {
  "display.numberOfLines": [TASK_LINES_MIN, TASK_LINES_MAX],
  "scroll.pixelsPerSecond": [1, 200],
  "scroll.gapBetweenLoops": [0, 300],
} as const satisfies Record<string, readonly [number, number]>;

type Unit = "px" | "rem" | "em" | "pt" | "%" | "vw" | "vh" | "";

/** px per unit for the absolute units. */
const PX_PER: Partial<Record<Unit, number>> = { px: 1, rem: 16, em: 16, pt: 4 / 3, "": 1 };

const TOKEN = /^(-?\d{1,5}(?:\.\d{1,4})?)(px|rem|em|pt|%|vw|vh)?$/i;

interface LengthToken {
  value: number;
  unit: Unit;
}

function parseToken(token: string): LengthToken | null {
  const match = TOKEN.exec(token);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  const unit = (match[2] ?? "").toLowerCase() as Unit;
  // A bare number is a CSS length only when it is 0.
  if (unit === "" && value !== 0) return null;
  return { value, unit };
}

/** The range of `limit` in `unit` itself (2–40 for `rem` when px is 32–640), or null when the unit isn't accepted. */
export function unitRange(limit: LengthLimit, unit: string): readonly [number, number] | null {
  const u = unit.toLowerCase() as Unit;
  if (u === "%") return limit.percent ?? null;
  if (u === "vw" || u === "vh") return limit.viewport ?? null;
  const per = PX_PER[u];
  if (per === undefined) return null;
  return [limit.px[0] / per, limit.px[1] / per];
}

export type LengthIssue = "format" | "count" | "unit" | "range";

/** Why `value` breaks `limit`, or null when it fits. Whitespace around it is ignored. */
export function lengthIssue(value: string, limit: LengthLimit): LengthIssue | null {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length > (limit.maxValues ?? 1)) return "count";
  for (const raw of tokens) {
    const token = parseToken(raw);
    if (!token) return "format";
    const range = unitRange(limit, token.unit);
    if (!range) return "unit";
    if (token.value < range[0] || token.value > range[1]) return "range";
  }
  return null;
}

/** "14–48px", "0–64px or 0–50%", "120–1200px, 10–100% or 10–100vw/vh" (+ "; up to 4 values"). */
export function describeLengthLimit(limit: LengthLimit): string {
  const parts = [`${limit.px[0]}–${limit.px[1]}px`];
  if (limit.percent) parts.push(`${limit.percent[0]}–${limit.percent[1]}%`);
  if (limit.viewport) parts.push(`${limit.viewport[0]}–${limit.viewport[1]}vw/vh`);
  const last = parts.pop() as string;
  const range = parts.length > 0 ? `${parts.join(", ")} or ${last}` : last;
  return (limit.maxValues ?? 1) > 1 ? `${range}; up to ${limit.maxValues} values` : range;
}

/** The inline error for a value `lengthIssue` rejects. */
export function lengthIssueMessage(issue: LengthIssue, limit: LengthLimit): string {
  const range = describeLengthLimit(limit);
  if (issue === "count") return `Too many values. Use ${range}`;
  if (issue === "range") return `Out of range. Use ${range}`;
  return `Use a length in ${range}`;
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * `value` held inside `limit` for reading a stored row: an out-of-range part is moved to
 * the nearest bound (an absolute one in px), and a value that can't be read at all (a
 * unit or shorthand the limit doesn't take) becomes `fallback`.
 */
export function clampLength(value: string, limit: LengthLimit, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const issue = lengthIssue(value, limit);
  if (issue === null) return value;
  if (issue !== "range") return fallback;
  return value
    .trim()
    .split(/\s+/)
    .map((raw) => {
      const token = parseToken(raw) as LengthToken;
      const range = unitRange(limit, token.unit) as readonly [number, number];
      if (token.value >= range[0] && token.value <= range[1]) return raw;
      const clamped = round(Math.min(range[1], Math.max(range[0], token.value)));
      if (token.unit === "%" || token.unit === "vw" || token.unit === "vh") {
        return `${clamped}${token.unit}`;
      }
      return `${round(clamped * (PX_PER[token.unit] as number))}px`;
    })
    .join(" ");
}

/** An integer style value held inside [min, max]; a non-finite one reads as `fallback`. */
export function clampInt(value: number, [min, max]: readonly [number, number], fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// ── Bullet and tick icons ────────────────────────────────────────────────────

/**
 * The task overlay's bullet and checkbox-tick icons: ids of lucide-react icons (ISC),
 * drawn as inline SVG by the web app (`components/overlay-icon.tsx`). Stored as the id in
 * the old free-text glyph columns; "none" draws nothing.
 */
export const OVERLAY_ICONS = [
  "dot",
  "circle",
  "check",
  "check-circle",
  "square-check",
  "star",
  "sparkles",
  "arrow-right",
  "chevron-right",
  "paw-print",
  "heart",
  "flame",
  "zap",
  "none",
] as const;

export type OverlayIcon = (typeof OVERLAY_ICONS)[number];

/** Accessible names for the picker. */
export const OVERLAY_ICON_LABELS: Record<OverlayIcon, string> = {
  dot: "Dot",
  circle: "Circle",
  check: "Check",
  "check-circle": "Check in circle",
  "square-check": "Check in square",
  star: "Star",
  sparkles: "Sparkles",
  "arrow-right": "Arrow",
  "chevron-right": "Chevron",
  "paw-print": "Paw print",
  heart: "Heart",
  flame: "Flame",
  zap: "Lightning",
  none: "None",
};

export const DEFAULT_BULLET_ICON: OverlayIcon = "dot";
export const DEFAULT_TICK_ICON: OverlayIcon = "check";

/** Glyphs the old free-text fields commonly held, read back as their icon. */
const LEGACY_GLYPH_ICONS: Readonly<Record<string, OverlayIcon>> = {
  "•": "dot",
  "·": "dot",
  "●": "dot",
  "○": "circle",
  "◦": "circle",
  "✔": "check",
  "✓": "check",
  "✔️": "check",
  "✅": "check-circle",
  "☑": "square-check",
  "☑️": "square-check",
  "★": "star",
  "☆": "star",
  "⭐": "star",
  "✨": "sparkles",
  "→": "arrow-right",
  "➜": "arrow-right",
  "➤": "arrow-right",
  "›": "chevron-right",
  "❯": "chevron-right",
  ">": "chevron-right",
  "🐾": "paw-print",
  "♥": "heart",
  "❤": "heart",
  "❤️": "heart",
  "🔥": "flame",
  "⚡": "zap",
};

export function isOverlayIcon(value: unknown): value is OverlayIcon {
  return typeof value === "string" && (OVERLAY_ICONS as readonly string[]).includes(value);
}

/** A stored icon column as an icon id: a known id, a known old glyph's icon, else `fallback`. */
export function toOverlayIcon(value: unknown, fallback: OverlayIcon): OverlayIcon {
  if (isOverlayIcon(value)) return value;
  if (typeof value === "string" && Object.hasOwn(LEGACY_GLYPH_ICONS, value.trim())) {
    return LEGACY_GLYPH_ICONS[value.trim()] as OverlayIcon;
  }
  return fallback;
}

// ── Phase labels ─────────────────────────────────────────────────────────────

/** A phase label fits the timer ring at the default size: at most 16 user-perceived characters… */
export const PHASE_LABEL_MAX_GRAPHEMES = 16;
/** …and 48 UTF-8 bytes, so a few long emoji sequences can't make a huge label. */
export const PHASE_LABEL_MAX_BYTES = 48;

export type PhaseLabelIssue = "graphemes" | "bytes";

export function phaseLabelIssue(value: string): PhaseLabelIssue | null {
  if (graphemes(value).length > PHASE_LABEL_MAX_GRAPHEMES) return "graphemes";
  if (utf8ByteLength(value) > PHASE_LABEL_MAX_BYTES) return "bytes";
  return null;
}

/** A stored label cut to fit both caps, never mid-character. */
export function clampPhaseLabel(value: string): string {
  if (phaseLabelIssue(value) === null) return value;
  let out = "";
  let count = 0;
  for (const g of graphemes(value)) {
    if (count === PHASE_LABEL_MAX_GRAPHEMES) break;
    if (utf8ByteLength(out + g) > PHASE_LABEL_MAX_BYTES) break;
    out += g;
    count += 1;
  }
  return out.trimEnd();
}
