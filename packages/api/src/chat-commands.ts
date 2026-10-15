// ── Chat command names (zod-free, schema-free) ──────────────────────────────
// Kept out of config-shared so the browser bot page can decide which chat lines
// are Dirework commands without bundling zod and the Drizzle schema.
// Re-exported by config-shared; the server's chat resolver (bot/commands.ts)
// parses through the same helpers, so the bot page and the server can never
// disagree on what counts as a command.

// Canonical bot command names an alias may target — stored WITHOUT the leading
// "!". The chat resolver, the tRPC input schema, and the dashboard editor all
// normalize through this so the three can never disagree on whether the "!" is
// part of the token (the "!!task" bug: the UI stored "!t"→"!task", the resolver
// re-prefixed "!" and produced "!!t"/"!!task").
export const KNOWN_ALIAS_TARGETS = [
  "task",
  "done",
  "edit",
  "remove",
  "focus",
  "check",
  "next",
  "help",
  "clear",
  "timer",
] as const;

/** Always-on meta commands. Not alias targets, but their names can't be aliased either. */
export const META_COMMANDS = ["dwhelp", "dwcommands"] as const;

const BUILTIN_COMMAND_NAMES = new Set<string>([...KNOWN_ALIAS_TARGETS, ...META_COMMANDS]);

/** True when a canonical token (no "!") is a built-in command name. */
export function isBuiltinCommandName(token: string): boolean {
  return BUILTIN_COMMAND_NAMES.has(token);
}

/** Strip any leading "!", trim, lowercase, take the first token → canonical alias/target. */
export function normalizeAliasToken(raw: string): string {
  return raw.trim().replace(/^!+/, "").trim().toLowerCase().split(/\s+/)[0] ?? "";
}

/**
 * U+E0000, which Chatterino/7TV append to a repeated message to slip past
 * Twitch's duplicate-message filter. Invisible, so strip it before parsing.
 * Only this code point: the rest of the tag block and ZWJ are legitimate parts
 * of emoji sequences.
 */
export const DUPLICATE_BYPASS_SUFFIX = /\u{E0000}/gu;

/** A chat line as the command parser sees it: bypass suffix stripped, trimmed. */
export function cleanChatLine(message: string): string {
  return message.replace(DUPLICATE_BYPASS_SUFFIX, "").trim();
}

/**
 * The lowercased first word of a chat line WITH its leading "!" ("!task"), or
 * null when the line is not a "!" command. Exactly how the server resolver
 * reads the command before alias resolution.
 */
export function chatCommandOf(message: string): string | null {
  const line = cleanChatLine(message);
  if (!line.startsWith("!")) return null;
  const first = line.split(/\s+/)[0];
  return first ? first.toLowerCase() : null;
}

/**
 * True when a chat line could run a Dirework command: its first word is a
 * built-in or meta command, or one of the instance's alias keys (canonical,
 * no "!"). The bot page uses it to skip other bots' commands (`!lurk`, `!so`)
 * without a Worker request; `bot.ingest` stays authoritative.
 */
export function isDireworkCommandLine(message: string, aliasKeys: ReadonlySet<string>): boolean {
  const command = chatCommandOf(message);
  if (!command) return false;
  const word = command.slice(1);
  return isBuiltinCommandName(word) || aliasKeys.has(word);
}
