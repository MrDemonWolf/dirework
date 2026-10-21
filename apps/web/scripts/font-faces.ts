/**
 * Pure parsing/validation for scripts/fetch-fonts.ts. The Google Fonts CSS is
 * remote input that ends up in file names and in the generated fonts.css, so
 * every value is allowlisted rather than trusted.
 */
import path from "node:path";

export interface Face {
  family: string;
  weight: string;
  style: "normal" | "italic";
  url: string;
}

/** A single weight ("400") or a variable range ("400 700"). */
const WEIGHT_RE = /^\d{3}(?: \d{3})?$/;
const FONT_HOST = "fonts.gstatic.com";

/** Keep only latin-subset blocks (css2 labels them; legacy CSS has no labels — keep all). */
export function latinBlocks(css: string): string[] {
  const labeled = [...css.matchAll(/\/\* ([a-z0-9-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)];
  if (labeled.length === 0) return [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].map((m) => m[0]);
  return labeled.filter((m) => m[1] === "latin").map((m) => m[2] ?? "");
}

/**
 * Parse one @font-face block, or null when it has no woff2 source or any value
 * falls outside the allowlist (unexpected weight/style, or a non-gstatic host).
 */
export function parseFace(block: string, family: string): Face | null {
  const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host !== FONT_HOST) return null;

  const weight = block.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? "400";
  const style = block.match(/font-style:\s*([^;]+);/)?.[1]?.trim() ?? "normal";
  if (!WEIGHT_RE.test(weight)) return null;
  if (style !== "normal" && style !== "italic") return null;
  return { family, weight, style, url };
}

/** The only origin a font file is ever downloaded from. */
export const FONT_URL_PREFIX = `https://${FONT_HOST}/`;

/** True when `url` is a fonts.gstatic.com HTTPS URL (checked again right before download). */
export function isAllowedFontUrl(url: string): boolean {
  return url.startsWith(FONT_URL_PREFIX);
}

const WEIGHT_STEPS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

/**
 * Every weight string the script will ever put in a file name or in fonts.css: the nine
 * static weights and each ascending variable range between them. All are built here from
 * constants, never from a response.
 */
export const KNOWN_WEIGHTS: readonly string[] = [
  ...WEIGHT_STEPS,
  ...WEIGHT_STEPS.flatMap((low, i) => WEIGHT_STEPS.slice(i + 1).map((high) => `${low} ${high}`)),
];

/**
 * Map a weight parsed from a Google Fonts response onto our own constant, or null when it
 * isn't one. Callers use the RETURNED value, so a file name or CSS rule never carries a
 * string that came off the network.
 */
export function canonicalWeight(weight: string): string | null {
  return KNOWN_WEIGHTS.find((known) => known === weight) ?? null;
}

/** woff2 files start with the "wOF2" signature. */
export function isWoff2(buf: Uint8Array): boolean {
  return buf.length > 4 && buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x32;
}

/** Output file name for a face; throws if it would escape `outDir`. */
export function faceFileName(outDir: string, family: string, weight: string): string {
  const slug = family.toLowerCase().replace(/ /g, "-");
  const file = `${slug}-${weight.replace(/ /g, "_")}.woff2`;
  const root = path.resolve(outDir);
  if (!/^[a-z0-9_-]+\.woff2$/.test(file) || !path.resolve(root, file).startsWith(root + path.sep)) {
    throw new Error(`Refusing to write font outside ${root}: ${file}`);
  }
  return file;
}
