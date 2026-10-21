// Fits the timer widget's text lines (phase label, countdown, cycle) inside the
// progress ring's inner area. Pure geometry: TimerDisplay measures each line's
// natural (configured-size) box once and applies the scales this returns, so the
// text only ever shrinks, never grows past the configured size.

import { cssLengthToPx } from "./timer-utils";

/** The clear area text may use: the shape the ring's inner edge (or the panel) traces. */
export type FitShape =
  | { kind: "circle"; cx: number; cy: number; radius: number }
  | { kind: "rect"; left: number; top: number; right: number; bottom: number; radius: number };

/** Breathing room (px) kept between the text and the ring's inner edge, on each side. */
export const FIT_PADDING_PX = 6;

/**
 * The smallest a line is shrunk to, as a fraction of its configured size. Past it the
 * line stays at this size and is cut with an ellipsis instead (a 500-byte phase label
 * would otherwise shrink to an unreadable sliver).
 */
export const MIN_FIT_SCALE = 0.5;

/**
 * The text area of a `width`×`height` timer frame. With the ring on, it is bounded by
 * the stroke's inner edge (the stroke is centered `width / 2 + gap` in from the frame,
 * so its inner edge sits `width + gap` in); with it off, by the panel itself. The shape
 * follows the panel's corner radius exactly as ProgressRing draws it: `50%` is a circle
 * on the shorter side, anything else a rounded rect whose first radius value is a
 * percentage of the shorter side or a CSS length.
 */
export function fitShape(
  width: number,
  height: number,
  borderRadius: string,
  ring: { enabled: boolean; width: number; gap: number },
): FitShape {
  const stroke = ring.enabled ? Math.max(0, ring.width) : 0;
  const gap = ring.enabled ? Math.max(0, ring.gap) : 0;
  const inset = stroke + gap;
  const isCircle = borderRadius === "50%" || borderRadius === "50";
  if (isCircle) {
    return {
      kind: "circle",
      cx: width / 2,
      cy: height / 2,
      radius: Math.max(0, Math.min(width, height) / 2 - inset),
    };
  }
  // ProgressRing's path runs along the stroke's centerline; its corner radius is
  // measured there, and the inner edge's corner is half a stroke tighter.
  const centerInset = stroke / 2 + gap;
  const centerW = Math.max(0, width - centerInset * 2);
  const centerH = Math.max(0, height - centerInset * 2);
  const first = borderRadius.trim().split(/\s+/)[0] ?? "";
  const centerRadius = first.endsWith("%")
    ? (Number.parseFloat(first) / 100) * Math.min(centerW, centerH)
    : (cssLengthToPx(first) ?? 0);
  const clamped = Math.max(0, Math.min(centerRadius || 0, centerW / 2, centerH / 2));
  return {
    kind: "rect",
    left: inset,
    top: inset,
    right: Math.max(inset, width - inset),
    bottom: Math.max(inset, height - inset),
    radius: Math.max(0, clamped - stroke / 2),
  };
}

/** Half the shape's horizontal extent at height `y` (0 outside it). */
function halfWidthAt(shape: FitShape, y: number): number {
  if (shape.kind === "circle") {
    const dy = y - shape.cy;
    const r2 = shape.radius * shape.radius - dy * dy;
    return r2 > 0 ? Math.sqrt(r2) : 0;
  }
  if (y < shape.top || y > shape.bottom) return 0;
  const half = (shape.right - shape.left) / 2;
  const r = Math.min(shape.radius, half, (shape.bottom - shape.top) / 2);
  // Inside a corner band the edge curves inward along the corner's arc.
  const dy = Math.max(shape.top + r - y, y - (shape.bottom - r), 0);
  if (dy === 0) return half;
  return half - r + Math.sqrt(Math.max(0, r * r - dy * dy));
}

/**
 * Horizontal room (px) for a line whose box spans `top`..`bottom`: the narrowest chord
 * of the shape across that band, less the padding on both sides. Both shapes are convex
 * and symmetric, so the narrowest chord is at whichever edge is farther from the middle.
 */
export function availableWidth(
  shape: FitShape,
  top: number,
  bottom: number,
  padding = FIT_PADDING_PX,
): number {
  const half = Math.min(halfWidthAt(shape, top), halfWidthAt(shape, bottom));
  return Math.max(0, 2 * (half - padding));
}

/** Vertical room (px) through the middle of the shape, less the padding. */
function availableHeight(shape: FitShape, padding: number): number {
  const full = shape.kind === "circle" ? 2 * shape.radius : shape.bottom - shape.top;
  return Math.max(0, full - 2 * padding);
}

/** A line's box at its configured font size, in unscaled layout px. */
export interface LineSize {
  width: number;
  height: number;
}

export interface LineFit {
  /** Multiply the configured font size by this (≤ 1). */
  scale: number;
  /** Set when even MIN_FIT_SCALE is too wide: clip the line to this width with an ellipsis. */
  maxWidth: number | null;
}

/**
 * Scales for a vertically centered stack of lines (`gap` px apart, like the widget's
 * flex column) so every line fits inside `shape`. First the whole stack shrinks
 * uniformly if it is taller than the shape; then each line shrinks on its own until
 * it is no wider than the chord at its own height. Shrinking a line only moves the
 * others toward the middle, where a convex shape is wider, so a couple of passes
 * settle it. Scales never exceed 1.
 */
export function fitTimerLines(
  shape: FitShape,
  frameHeight: number,
  lines: readonly LineSize[],
  gap: number,
  padding = FIT_PADDING_PX,
): LineFit[] {
  const scales = lines.map(() => 1);
  const totalGap = gap * Math.max(0, lines.length - 1);
  const naturalHeight = lines.reduce((sum, line) => sum + line.height, 0);
  const roomY = availableHeight(shape, padding) - totalGap;
  if (naturalHeight > 0 && naturalHeight > roomY) {
    scales.fill(Math.max(0, roomY) / naturalHeight);
  }

  const maxWidths: (number | null)[] = lines.map(() => null);
  for (let pass = 0; pass < 3; pass++) {
    const heights = lines.map((line, i) => line.height * (scales[i] ?? 1));
    let y = (frameHeight - (heights.reduce((a, b) => a + b, 0) + totalGap)) / 2;
    lines.forEach((line, i) => {
      const height = heights[i] ?? 0;
      const room = availableWidth(shape, y, y + height, padding);
      y += height + gap;
      maxWidths[i] = null;
      if (line.width <= 0) return;
      const wanted = room / line.width;
      if (wanted >= (scales[i] ?? 1)) return;
      if (wanted < MIN_FIT_SCALE) {
        scales[i] = Math.min(scales[i] ?? 1, MIN_FIT_SCALE);
        maxWidths[i] = Math.floor(room);
      } else {
        scales[i] = wanted;
      }
    });
  }

  return scales.map((scale, i) => ({
    // Rounded down, so the rounding can never push a line back over the edge.
    scale: Math.floor(Math.min(1, scale) * 1000) / 1000,
    maxWidth: maxWidths[i] ?? null,
  }));
}

/** A configured CSS font size scaled by `scale` (unchanged at 1). */
export function scaledFontSize(configured: string, scale: number): string {
  return scale >= 1 ? configured : `calc(${configured} * ${scale})`;
}
