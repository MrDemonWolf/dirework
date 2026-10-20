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

// ── Reply templates ──────────────────────────────────────────────────────────

const VARIABLES = {
  user: { description: "The viewer who sent the command" },
  channel: { description: "Your channel name" },
  task: { description: "The task's text", sample: "write the intro" },
  oldTask: { description: "The task just finished (!next)", sample: "outline the video" },
  newTask: { description: "The task just started (!next)", sample: "record the intro" },
  user2: { description: "The viewer being looked up (!check @user)", sample: "another_viewer" },
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
function fitToChatBytes(template: string, vars: Record<string, string>): string {
  const full = fillTemplate(template, vars);
  if (utf8ByteLength(full) <= MAX_CHAT_BYTES) return full;

  const slots = TASK_TEXT_VARS.flatMap((key) => {
    const value = Object.hasOwn(vars, key) ? vars[key] : undefined;
    const count = template.split(`{${key}}`).length - 1;
    return value === undefined || count === 0 ? [] : [{ key, value, count }];
  });
  if (slots.length === 0) return full;

  const fixed = { ...vars };
  for (const { key } of slots) fixed[key] = "";
  let budget = MAX_CHAT_BYTES - utf8ByteLength(fillTemplate(template, fixed));
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
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  const out = fitToChatBytes(template, vars);
  const lead = out.trimStart();
  if (CHAT_COMMAND_LEAD.test(lead) && lead[0] !== template.trimStart()[0]) {
    return lead.replace(/^[!./\s]+/, "");
  }
  return out;
}
