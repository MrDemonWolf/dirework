import { cssLengthSchema } from "@dirework/api/config-shared";
import {
  describeLengthLimit,
  type LengthLimit,
  lengthIssue,
  lengthIssueMessage,
  unitRange,
} from "@dirework/api/style-limits";

/**
 * The inline error for a length field, or null when the server would take it: the CSS
 * allowlist first, then the field's range (`limit`, from @dirework/api/style-limits —
 * the same check `boundedLengthSchema` runs on save).
 */
export function lengthFieldError(value: string, limit?: LengthLimit): string | null {
  if (!cssLengthSchema.safeParse(value).success) {
    return limit
      ? `Use a length in ${describeLengthLimit(limit)}`
      : "Use a CSS length like 12px, 50% or 1.5rem";
  }
  const issue = limit ? lengthIssue(value.trim(), limit) : null;
  return issue && limit ? lengthIssueMessage(issue, limit) : null;
}

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
 * With `limit` the result stays inside the field's range in the value's own unit (an
 * out-of-range value steps onto the nearest bound), and a unit the field doesn't take
 * returns null, leaving the inline error to explain.
 */
export function stepLength(
  value: string,
  delta: number,
  unit?: string,
  limit?: LengthLimit,
): string | null {
  const match = SINGLE_LENGTH.exec(value.trim());
  if (!match?.[1]) return null;
  const suffix = match[2] || unit || "";
  const [min, max] = limit ? (unitRange(limit, suffix) ?? [Number.NaN, 0]) : [0, Infinity];
  if (Number.isNaN(min)) return null;
  // Round away float noise (0.1 + 0.2) without truncating a typed fraction.
  const stepped = Math.round((Number(match[1]) + delta) * 10_000) / 10_000;
  const next = Math.min(max, Math.max(Math.max(0, min), stepped));
  return next === 0 && !match[2] ? "0" : `${next}${suffix}`;
}
