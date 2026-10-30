// ── Chat text helpers (zod-free, schema-free) ───────────────────────────────
// Kept out of config-shared so the browser bot page and the dashboard can import
// them without bundling zod and the Drizzle schema. Re-exported by config-shared.
//
// An IRC line is capped at 512 BYTES including command overhead and CRLF, and
// Twitch caps the visible message at 500 characters. Message templates expand
// at send time ({user}, {task}, …), so templates are capped well below the wire
// limit to leave interpolation headroom.

/** Max bytes for a fully-interpolated chat message put on the wire. */
export const MAX_CHAT_BYTES = 450;

/**
 * Longest chat line `bot.ingest` accepts. The ingest schema (routers/bot.ts)
 * caps `message` at it and the bot page clamps its relay to it with
 * truncateToLength; both read this one constant, so what the page sends
 * always fits what the server accepts.
 */
export const MAX_RELAYED_MESSAGE_LENGTH = 600;

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
 * Truncate to at most `maxLength` UTF-16 code units (the unit `.length` counts)
 * WITHOUT splitting a surrogate pair. zod's string `.max()` counts code points,
 * and a string never has more code points than code units, so the result
 * still passes a tRPC schema with the same cap. A plain `.slice(0, n)` can
 * leave a lone high surrogate (invalid UTF-16) at the cut. As with
 * truncateToBytes, a multi-code-point grapheme cluster may still be shortened.
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

/**
 * Most combining marks (Unicode category M) kept on one base character. Two
 * covers real scripts (Vietnamese stacks two diacritics, Indic and Thai a vowel
 * sign plus a tone or virama, an emoji keycap a variation selector plus U+20E3);
 * "Zalgo" text piles dozens on each letter, which draws far above and below the
 * line and over the neighbouring overlay rows.
 */
export const MAX_COMBINING_MARKS = 2;

/** A run of MAX_COMBINING_MARKS marks (captured) followed by any more. */
const EXCESS_COMBINING_MARKS = new RegExp(`(\\p{M}{${MAX_COMBINING_MARKS}})\\p{M}+`, "gu");

/**
 * Drop every combining mark past MAX_COMBINING_MARKS in each run, so Zalgo text
 * keeps its letters but loses the stack. Applied where task text and display
 * names enter (task-service, the chat commands, bot ingest) and again by the
 * task overlay at render, for rows stored before this existed. Never empties
 * a non-empty string: the base characters all survive.
 */
export function limitCombiningMarks(value: string): string {
  return value.replace(EXCESS_COMBINING_MARKS, "$1");
}

/** Bidi embeddings/overrides (U+202A–U+202E) and isolates (U+2066–U+2069). */
const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/u;
/** Invisible characters with no joining role: ZWSP, word joiner and friends, BOM/ZWNBSP. */
const INVISIBLE = /[\u200B\u2060-\u2064\uFEFF]/u;
/** C0/C1 controls, DEL and the Unicode line/paragraph separators. */
function isLineBreakingControl(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029
  );
}
const ZWNJ = "\u200C";
const ZWJ = "\u200D";
const EMOJI = /\p{Extended_Pictographic}/u;
/** What may sit between an emoji and the ZWJ after it (variation selector, skin tone). */
const EMOJI_TAIL = /[\uFE0F\p{Emoji_Modifier}]/u;
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;

/** The emoji a ZWJ at `index` follows, skipping its variation selector / skin tone. */
function emojiBefore(chars: readonly string[], index: number): boolean {
  let i = index - 1;
  while (i >= 0 && EMOJI_TAIL.test(chars[i] as string)) i--;
  return i >= 0 && EMOJI.test(chars[i] as string);
}

/**
 * A joiner keeps its job only between two letters (Persian, Indic and other
 * scripts shape with ZWNJ/ZWJ) or, for ZWJ, between two emoji (woman technologist,
 * rainbow flag).
 * Anywhere else it is invisible padding.
 */
function keepJoiner(chars: readonly string[], index: number): boolean {
  const prev = chars[index - 1];
  const next = chars[index + 1];
  if (prev === undefined || next === undefined) return false;
  if (LETTER_OR_MARK.test(prev) && LETTER_OR_MARK.test(next)) return true;
  return chars[index] === ZWJ && EMOJI.test(next) && emojiBefore(chars, index);
}

/**
 * Make viewer-supplied text safe to show on the overlay, the dashboard and in
 * chat replies: bidi overrides and isolates are dropped (they reverse the text
 * after them, so a U+202E in "!task" text could make a row or a reply read backwards or
 * hide what it says), invisible zero-width characters are dropped (ZWJ/ZWNJ
 * are kept where they join letters, and ZWJ inside an emoji sequence), control
 * characters and line separators become spaces, and Zalgo stacks are cut by
 * limitCombiningMarks. Zod-free so the overlay can run it at render for rows
 * stored before it existed. May return an empty or blank string (text that was
 * only invisible characters): callers that need text check after it.
 */
export function sanitizeDisplayText(value: string): string {
  const chars = Array.from(value);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    if (isLineBreakingControl(ch)) out += " ";
    else if (BIDI_CONTROL.test(ch) || INVISIBLE.test(ch)) continue;
    else if (ch === ZWJ || ch === ZWNJ) {
      if (keepJoiner(chars, i)) out += ch;
    } else out += ch;
  }
  return limitCombiningMarks(out);
}

/** Longest stored author display name, in UTF-16 units: Twitch caps display names at 25. */
export const MAX_DISPLAY_NAME_LENGTH = 25;

/**
 * The display name stored on a chat task: sanitized (sanitizeDisplayText),
 * trimmed and capped at MAX_DISPLAY_NAME_LENGTH, falling back to the login when
 * nothing visible is left (or none was sent).
 */
export function chatDisplayName(displayName: string | undefined, login: string): string {
  const name = truncateToLength(
    sanitizeDisplayText(displayName ?? "").trim(),
    MAX_DISPLAY_NAME_LENGTH,
  );
  return name || login;
}

// ── Reply templates ──────────────────────────────────────────────────────────

const VARIABLES = {
  user: { description: "The viewer who sent the command" },
  channel: { description: "Your channel name" },
  task: { description: "The task's text", sample: "write the intro" },
  oldTask: { description: "The task just finished (!next)", sample: "outline the video" },
  newTask: { description: "The task just started (!next)", sample: "record the intro" },
  user2: { description: "The viewer being looked up (!check @user)", sample: "another_viewer" },
  count: { description: "Tasks the viewer has going after !start", sample: "2" },
  max: { description: "Most tasks one viewer can have going at once", sample: "3" },
  phase: { description: "Time left in the current phase", sample: "12m" },
  time: { description: "Time left in the whole session", sample: "1h 40m" },
} as const;

/** A placeholder name as it appears inside the braces: `{task}` → `task`. */
export type TemplateVariableName = keyof typeof VARIABLES;

/**
 * Every placeholder a reply template may use: the copy the dashboard shows on the
 * variable chips and the sample value its preview fills in. `user` and `channel`
 * have no fixed sample — the dashboard stands the streamer's own name in, so a
 * preview reads like a line in their chat. Adding a variable here is not enough
 * on its own: the handler in bot/commands.ts that sends the reply must pass it.
 */
export const TEMPLATE_VARIABLES: Record<
  TemplateVariableName,
  { description: string; sample?: string }
> = VARIABLES;

/** A leading character that would make the bot run a chat command. */
const CHAT_COMMAND_LEAD = /^[!./]/;

/** Variables carrying viewer task text — the only ones long enough to overflow a chat line. */
const TASK_TEXT_VARS = [
  "task",
  "oldTask",
  "newTask",
] as const satisfies readonly TemplateVariableName[];
const ELLIPSIS = "…";

/** Fill `{name}` placeholders from `vars`; a placeholder with no value is left as typed. */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] as string) : match,
  );
}

/**
 * When the filled template exceeds MAX_CHAT_BYTES, shorten the task-text
 * variables (with an ellipsis) so the rest of the template — closing words and
 * the {user} mention — survives instead of being cut off the end by the
 * wire-level truncation.
 */
function fitToChatBytes(template: string, vars: Record<string, string>, maxBytes: number): string {
  const full = fillTemplate(template, vars);
  if (utf8ByteLength(full) <= maxBytes) return full;

  const slots = TASK_TEXT_VARS.flatMap((key) => {
    const value = Object.hasOwn(vars, key) ? vars[key] : undefined;
    const count = template.split(`{${key}}`).length - 1;
    return value === undefined || count === 0 ? [] : [{ key, value, count }];
  });
  if (slots.length === 0) return full;

  const fixed = { ...vars };
  for (const { key } of slots) fixed[key] = "";
  let budget = maxBytes - utf8ByteLength(fillTemplate(template, fixed));
  let remaining = slots.reduce((sum, slot) => sum + slot.count, 0);

  // Shortest first, so a short {oldTask} keeps its full text and leaves the
  // rest of the budget to a long {newTask}.
  const bounded = { ...vars };
  const ellipsisBytes = utf8ByteLength(ELLIPSIS);
  slots.sort((a, b) => utf8ByteLength(a.value) - utf8ByteLength(b.value));
  for (const { key, value, count } of slots) {
    const share = Math.floor(budget / remaining);
    const fitted =
      utf8ByteLength(value) <= share
        ? value
        : `${truncateToBytes(value, Math.max(0, share - ellipsisBytes))}${ELLIPSIS}`;
    bounded[key] = fitted;
    budget -= utf8ByteLength(fitted) * count;
    remaining -= count;
  }
  return fillTemplate(template, bounded);
}

/**
 * Render a reply template exactly as the bot sends it: `{name}` placeholders
 * filled, bounded to the chat byte cap, and never opening with a chat command.
 * A substituted value (viewer task text) starting with `!cmd` would run in
 * other channel bots with this bot's role, `/me` or `.ban` in Twitch itself —
 * so a leading command character the owner's template didn't start with is
 * stripped. Templates that deliberately start with `/me` or `!` keep working.
 * The dashboard calls this with sample values to preview a template.
 * `maxBytes` (default MAX_CHAT_BYTES) leaves room for a note the caller appends.
 */
export function interpolate(
  template: string,
  vars: Record<string, string>,
  maxBytes: number = MAX_CHAT_BYTES,
): string {
  const out = fitToChatBytes(template, vars, maxBytes);
  const lead = out.trimStart();
  if (CHAT_COMMAND_LEAD.test(lead) && lead[0] !== template.trimStart()[0]) {
    return lead.replace(/^[!./\s]+/, "");
  }
  return out;
}

// ── Placeholder repeat cap ───────────────────────────────────────────────────

/**
 * The most times one `{name}` placeholder may appear in a reply template. Each
 * `{task}` can expand to a whole task, so a template repeating one placeholder
 * only produces a reply the byte fitting has to cut to pieces. The save schema
 * (`chatMessageSchema`) rejects more; a template stored before the cap is
 * trimmed on read (`limitPlaceholderRepeats`, via `buildBotConfig`).
 */
export const MAX_PLACEHOLDER_REPEATS = 4;

const PLACEHOLDER = /\{(\w+)\}/g;

/** The placeholder `template` uses most and how many times (null when it has none). */
export function mostRepeatedPlaceholder(template: string): { name: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1] as string;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let top: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (!top || count > top.count) top = { name, count };
  }
  return top;
}

/** `template` with every placeholder past its MAX_PLACEHOLDER_REPEATS-th use removed. */
export function limitPlaceholderRepeats(template: string): string {
  const seen = new Map<string, number>();
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count > MAX_PLACEHOLDER_REPEATS ? "" : match;
  });
}

// ── Graphemes ────────────────────────────────────────────────────────────────

/** User-perceived characters (an emoji with skin tone or a flag counts once). */
export function graphemes(value: string): string[] {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value),
    (s) => s.segment,
  );
}

/** How many user-perceived characters `value` has. */
export function graphemeLength(value: string): number {
  return graphemes(value).length;
}
