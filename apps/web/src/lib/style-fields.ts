const BARE_NUMBER = /^\d{1,5}(?:\.\d{1,4})?$/;

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
