// WCAG 2.2 contrast math shared by the contrast gates (obs-contrast, tokens-contrast,
// theme-contrast), so a fix to the math lands in all of them at once. Channels are
// gamma-encoded sRGB in 0–1. wcag.test.ts holds it to the published reference ratios.

export type Rgb = [number, number, number];

/** `#rrggbb` (either case) → 0–1 channels. */
export function parseHex(value: string): Rgb {
  const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (!m) throw new Error(`not a #rrggbb literal: ${value}`);
  return [m[1], m[2], m[3]].map((x) => Number.parseInt(x ?? "0", 16) / 255) as Rgb;
}

/**
 * WCAG relative luminance, linearising at 0.04045 (WCAG 2.2's value; the older 0.03928
 * gives the same result for every 8-bit channel).
 */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1–21, in either argument order. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over compositing of `top` at `alpha` onto an opaque `bottom`, in sRGB. */
export function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((c, i) => c * alpha + (bottom[i] ?? 0) * (1 - alpha)) as Rgb;
}
