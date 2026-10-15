// ── Chat text helpers (zod-free, schema-free) ───────────────────────────────
// Kept out of config-shared so the browser bot page can import them without
// bundling zod and the Drizzle schema. Re-exported by config-shared.
//
// An IRC line is capped at 512 BYTES including command overhead and CRLF, and
// Twitch caps the visible message at 500 characters. Message templates expand
// at send time ({user}, {task}, …), so templates are capped well below the wire
// limit to leave interpolation headroom.

/** Max bytes for a fully-interpolated chat message put on the wire. */
export const MAX_CHAT_BYTES = 450;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Truncate to at most `maxBytes` UTF-8 bytes WITHOUT splitting a character.
 * A plain `.slice(n)` counts UTF-16 code units, so 500 emoji is ~2000 bytes and
 * gets mangled or rejected by Twitch — this is the byte-correct version.
 */
export function truncateToBytes(value: string, maxBytes: number = MAX_CHAT_BYTES): string {
  if (utf8ByteLength(value) <= maxBytes) return value;
  let out = "";
  let bytes = 0;
  // Iterating the string yields whole code points, so a surrogate pair (an
  // emoji, say) is never cut in half. Multi-code-point grapheme clusters —
  // combining marks, ZWJ emoji sequences, flags — CAN still be cut between
  // code points; the result is always valid UTF-8, just possibly missing the
  // tail of the last visible character.
  for (const ch of value) {
    const size = utf8ByteLength(ch);
    if (bytes + size > maxBytes) break;
    out += ch;
    bytes += size;
  }
  return out;
}

/**
 * Truncate to at most `maxLength` UTF-16 code units — the unit `.length` and
 * zod's `.max()` count, so the result still passes the tRPC schema — WITHOUT
 * splitting a surrogate pair. A plain `.slice(0, n)` can leave a lone high
 * surrogate (invalid UTF-16) at the cut. As with truncateToBytes, a
 * multi-code-point grapheme cluster may still be shortened.
 */
export function truncateToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  let out = "";
  for (const ch of value) {
    if (out.length + ch.length > maxLength) break;
    out += ch;
  }
  return out;
}

export function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) return true;
  }
  return false;
}

export function replaceControlCharacters(value: string): string {
  let output = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    output += codePoint <= 0x1f || codePoint === 0x7f ? " " : character;
  }
  return output;
}
