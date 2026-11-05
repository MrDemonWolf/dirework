// ── Chat command names and aliases (zod-free, schema-free) ──────────────────
// Kept out of config-shared so the browser bot page can decide which chat lines
// are Dirework commands, and the alias editor can check its rows, without
// bundling zod and the Drizzle schema. Re-exported by config-shared; the
// server's chat resolver (bot/commands.ts) and the alias input schema parse
// through the same helpers, so a bot page and the server built together never
// disagree on what counts as a command or a valid alias. A page left open
// across a deploy learns the newer server's names from bot.getSession
// (BUILTIN_COMMAND_NAMES).

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
  "start",
  "pause",
  "check",
  "today",
  "next",
  "help",
  "clear",
  "timer",
] as const;

/**
 * Always-on meta commands. Not alias targets, but their names can't be aliased either.
 * `dw` is the viewer help namespace (`!dw help`, `!dw help <command>`, `!dw commands`).
 */
export const META_COMMANDS = ["dw", "dwhelp", "dwcommands"] as const;

/**
 * Mod-only bot moderation commands. Built-in names (so the bot page relays them
 * and no alias can shadow them) but never alias targets: muting or blocking
 * through a nickname would make the moderation surface harder to audit.
 */
export const MODERATION_COMMANDS = ["mute", "unmute", "block", "unblock"] as const;

/** Upper bound on bot_config.blocked_viewers, enforced inside the guarded UPDATE. */
export const MAX_BLOCKED_VIEWERS = 200;

/** A Twitch login: lowercase letters, digits and underscores, 1–25 characters. */
export const TWITCH_LOGIN_PATTERN = /^[a-z0-9_]{1,25}$/;

/**
 * Normalize a typed username ("@Viewer", " viewer ") to the lowercase login the
 * block list stores, or null when it can't be a Twitch login. One leading "@"
 * is stripped so `!block @user` and the dashboard field accept the same input.
 */
export function normalizeTwitchLogin(raw: string): string | null {
  const login = raw.trim().replace(/^@/, "").toLowerCase();
  return TWITCH_LOGIN_PATTERN.test(login) ? login : null;
}

/**
 * Every built-in command name, canonical (no "!"): the alias targets, the meta and the
 * moderation commands. `bot.getSession` sends it to the bot page as `commands`, so a page
 * loaded before a deploy added a command relays that command too instead of dropping it.
 */
export const BUILTIN_COMMAND_NAMES: readonly string[] = [
  ...KNOWN_ALIAS_TARGETS,
  ...META_COMMANDS,
  ...MODERATION_COMMANDS,
];

const BUILTIN_COMMAND_NAME_SET: ReadonlySet<string> = new Set(BUILTIN_COMMAND_NAMES);

/** True when a canonical token (no "!") is a built-in command name. */
export function isBuiltinCommandName(token: string): boolean {
  return BUILTIN_COMMAND_NAME_SET.has(token);
}

/**
 * Longest alias name or command target, in characters, without the leading "!" (Twitch
 * logins cap at 25 too). `normalizeAliases` rejects longer ones; the alias editor's inputs
 * allow one more character for a typed "!".
 */
export const ALIAS_MAX_LENGTH = 25;

/** Strip any leading "!", trim, lowercase, take the first token → canonical alias/target. */
export function normalizeAliasToken(raw: string): string {
  return raw.trim().replace(/^!+/, "").trim().toLowerCase().split(/\s+/)[0] ?? "";
}

/**
 * True when an alias or target is more than one word ("!timer start"). Aliases
 * map one command name to another and carry no arguments, so normalizing would
 * silently drop everything after the first word.
 */
export function aliasTokenHasWhitespace(raw: string): boolean {
  return /\s/.test(raw.trim().replace(/^!+/, "").trim());
}

export type AliasIssueReason =
  | "empty"
  | "too-long"
  | "multi-word"
  | "shadows-builtin"
  | "duplicate"
  | "recursive"
  | "unknown-target";
export interface AliasIssue {
  key: string;
  reason: AliasIssueReason;
  /** Position of the offending entry in the input, so an editor can flag its row. */
  index: number;
}

/**
 * Normalize raw aliases (keys/values with or without "!") into canonical form
 * and collect validation issues. Reused by the router input schema AND the
 * dashboard editor so client and server validate identically. Rejects empty
 * tokens, keys or targets over ALIAS_MAX_LENGTH, multi-word keys/targets, keys that would replace a built-in command,
 * duplicate keys (after normalization), self-recursion, and targets that are
 * not real commands. Accepts entries as well as a record so the editor can
 * pass its rows without collapsing duplicates first.
 */
export function normalizeAliases(
  raw: Record<string, string> | Iterable<readonly [string, string]>,
): {
  aliases: Record<string, string>;
  issues: AliasIssue[];
} {
  const entries: Iterable<readonly [string, string]> =
    Symbol.iterator in raw ? raw : Object.entries(raw);
  // A Map, not `key in {}`: inherited names like "constructor" must not read as
  // duplicates, and "__proto__" must not be assigned to the prototype.
  const aliases = new Map<string, string>();
  const issues: AliasIssue[] = [];
  const known = new Set<string>(KNOWN_ALIAS_TARGETS);

  let index = -1;
  for (const [rawKey, rawValue] of entries) {
    index += 1;
    const key = normalizeAliasToken(rawKey);
    const target = normalizeAliasToken(rawValue);
    if (!key || !target) {
      issues.push({ key: rawKey || "(empty)", reason: "empty", index });
      continue;
    }
    if (key.length > ALIAS_MAX_LENGTH || target.length > ALIAS_MAX_LENGTH) {
      issues.push({ key, reason: "too-long", index });
      continue;
    }
    if (aliasTokenHasWhitespace(rawKey) || aliasTokenHasWhitespace(rawValue)) {
      issues.push({ key, reason: "multi-word", index });
      continue;
    }
    if (isBuiltinCommandName(key)) {
      issues.push({ key, reason: "shadows-builtin", index });
      continue;
    }
    if (aliases.has(key)) {
      issues.push({ key, reason: "duplicate", index });
      continue;
    }
    if (key === target) {
      issues.push({ key, reason: "recursive", index });
      continue;
    }
    if (!known.has(target)) {
      issues.push({ key, reason: "unknown-target", index });
      continue;
    }
    aliases.set(key, target);
  }
  return { aliases: Object.fromEntries(aliases), issues };
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
 * `serverCommands` is the running api's BUILTIN_COMMAND_NAMES (from
 * bot.getSession). It only adds names: one this copy was built with still counts.
 */
export function isDireworkCommandLine(
  message: string,
  aliasKeys: ReadonlySet<string>,
  serverCommands?: ReadonlySet<string>,
): boolean {
  const command = chatCommandOf(message);
  if (!command) return false;
  const word = command.slice(1);
  return isBuiltinCommandName(word) || aliasKeys.has(word) || serverCommands?.has(word) === true;
}
