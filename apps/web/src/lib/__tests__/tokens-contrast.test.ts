import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA (4.5:1) checks on the generated palette, computed from the oklch values
 * in design-system/tokens.json. Status chips render `text-success` /
 * `text-warning` on a `/10` tint of the same tone, and they sit on `.panel`
 * faces, so the tint is composited over `--card`.
 */

type Rgb = [number, number, number];

const tokens = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../../design-system/tokens.json", import.meta.url)),
    "utf8",
  ),
) as { color: { scheme: Record<"light" | "dark", Record<string, string>> } };

/** oklch → gamma-encoded sRGB (0–1, clamped) plus alpha. */
function parseOklch(value: string): { rgb: Rgb; alpha: number } {
  const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+)%)?\)$/.exec(value);
  if (!m) throw new Error(`not an oklch() literal: ${value}`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Rgb = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const encode = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return { rgb: linear.map(encode) as Rgb, alpha: m[4] === undefined ? 1 : Number(m[4]) / 100 };
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: Rgb, bg: Rgb): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` at `alpha` over an opaque `bottom`, in sRGB. */
function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((c, i) => c * alpha + (bottom[i] ?? 0) * (1 - alpha)) as Rgb;
}

describe.each(["light", "dark"] as const)("%s scheme contrast", (name) => {
  const scheme = tokens.color.scheme[name];
  const color = (key: string) => {
    const value = scheme[key];
    if (!value) throw new Error(`color.scheme.${name}.${key} missing`);
    const { rgb, alpha } = parseOklch(value);
    expect(alpha, `${key} must be opaque`).toBe(1);
    return rgb;
  };

  it.each([
    ["foreground", "background"],
    ["muted-foreground", "background"],
    ["primary-foreground", "primary"],
  ])("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["success", "warning"])("%s chip text on its /10 tint over --card ≥ 4.5:1", (tone) => {
    const fill = composite(color(tone), 0.1, color("card"));
    expect(contrast(color(tone), fill)).toBeGreaterThanOrEqual(4.5);
  });
});
