// The number part of a length: up to 5 digits, optionally up to 4 decimals.
const NUMBER = String.raw`\d{1,5}(?:\.\d{1,4})?`;
const BARE_NUMBER = new RegExp(`^${NUMBER}$`);

/**
 * A field labelled with a unit ("px") invites typing a bare number, which the
 * CSS-length allowlist rejects. Append the shown unit to a bare number (other
 * than 0, which is already a valid length); leave anything else for validation.
 */
export function withDefaultUnit(value: string, unit: string | undefined): string {
  const trimmed = value.trim();
  if (!unit || !BARE_NUMBER.test(trimmed) || Number(trimmed) === 0) return value;
  return `${trimmed}${unit}`;
}

const SINGLE_LENGTH = new RegExp(`^(${NUMBER})([a-z%]*)$`, "i");

/**
 * Arrow-key nudge for a length field: a single non-negative length ("20px", "1.5rem",
 * "50%", "12") moves by `delta` and keeps its unit, never going below 0; a bare number
 * gains `unit`, as `withDefaultUnit` would give it. Anything else (a multi-value padding
 * "10px 14px", an empty draft, a keyword) returns null, so the key keeps its default.
 */
export function stepLength(value: string, delta: number, unit?: string): string | null {
  const match = SINGLE_LENGTH.exec(value.trim());
  if (!match?.[1]) return null;
  // Round away float noise (0.1 + 0.2) without truncating a typed fraction.
  const next = Math.max(0, Math.round((Number(match[1]) + delta) * 10_000) / 10_000);
  const suffix = match[2] || unit || "";
  return next === 0 && !match[2] ? "0" : `${next}${suffix}`;
}
