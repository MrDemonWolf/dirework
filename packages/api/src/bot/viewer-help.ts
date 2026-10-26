// The `!dw` help namespace: a built-in starter guide and one plain-language line
// per command. Pure and env-free (no D1, no config reads beyond the BotConfigData
// bot.ingest already loaded), so answering help costs nothing past the claim.
//
// Copy rules (viewers may be new, tired or distracted): short sentences, one idea
// each, numbered steps, a real example in every command line, plain words ("your
// task number from !today", "the one you're working on now"), never scolding, at
// most one emoji per message. Every line is byte-checked in viewer-help.test.ts.

import { normalizeAliasToken } from "../chat-commands";
import { MAX_STARTED_PER_AUTHOR } from "../config-defaults";

/**
 * The three starter steps, shared by the built-in `!dw` guide and the default
 * `!help` reply (DEFAULT_TASK_MESSAGES.help, which a test pins to contain this).
 */
export const STARTER_STEPS =
  "1) Type !task and what you're working on, like !task read 10 pages. 2) Work along with the stream. 3) Type !done when you finish.";

/** `!dw` / `!dw help`: always built in, so every instance has a guide even if `!help` was reworded. */
export const DW_GUIDE_REPLY = (name: string) =>
  `${name}, here's how it works: ${STARTER_STEPS} ✅ Want help with one command? Type !dw help and its name, like !dw help done.`;

/** The guide while the streamer has task commands switched off: don't teach commands that won't answer. */
export const DW_TASKS_OFF_REPLY = (name: string) =>
  `${name}, the task list is off right now, so there's nothing to add. Just hang out and work along with the stream.`;

export const DW_TIMER_OFF_REPLY = (name: string) =>
  `${name}, the timer commands are off right now.`;

/** Never echoes what the viewer typed, so the reply can't be used to make the bot say things. */
export const DW_UNKNOWN_REPLY = (name: string) =>
  `${name}, I don't know that one. Try a command name, like !dw help task. !dw commands lists them all.`;

const MODS_ONLY = "(mods only)";

/**
 * One line per command, keyed by canonical name (no "!"). Each line was checked
 * against the handler in bot/commands.ts: keep them true when behavior changes.
 */
export const COMMAND_HELP_LINES: Readonly<Record<string, string>> = {
  task: "!task + what you're doing adds it to the list, like !task read 10 pages. Got one going already? The new one waits in line and starts after !done.",
  done: "!done finishes the one you're working on now. If another one is waiting, it starts by itself. To finish a different one, use its number from !today, like !done 2.",
  edit: "!edit + your task number from !today + the new words changes that task, like !edit 1 read 20 pages.",
  remove:
    "!remove + your task number from !today takes it off the list, like !remove 2. It isn't marked done, it's just gone.",
  focus:
    "!focus + your task number from !today makes it the one you're working on now, like !focus 2. The old one stays started if you have room, or waits in line.",
  start: `!start + your task number from !today starts it, like !start 2. You can have ${1 + MAX_STARTED_PER_AUTHOR} going at once. With nothing going yet, it becomes the one you're on now.`,
  pause:
    "!pause pauses the one you're on now, and your next one starts. To pause a different one, use its number from !today, like !pause 2. It waits in line.",
  check:
    "!check shows the one you're working on now and how many more you started. Add a name to see someone else's, like !check @friend.",
  today:
    "!today shows your plan: what you're on now, what's next, and each task's number. Just type !today. Use those numbers with !done, !edit, !start and !pause.",
  next: "!next + your next task finishes the one you're on now and starts the new one, like !next answer emails.",
  help: "!help shows the quick steps to get started. Just type !help.",
  clear: `${MODS_ONLY} !clear done removes finished tasks. !clear all empties the whole list. !clear @name removes one viewer's tasks.`,
  timer: `${MODS_ONLY} !timer runs the focus timer, like !timer start, pause, resume, skip, reset or eta. Add a number to set the rounds, like !timer start 4.`,
  mute: `${MODS_ONLY} !mute makes the bot go quiet and ignore commands. Just type !mute. Type !unmute to bring it back.`,
  unmute: `${MODS_ONLY} !unmute turns the bot back on after !mute. Just type !unmute.`,
  block: `${MODS_ONLY} !block + a name makes the bot ignore that viewer and removes their tasks, like !block @spammer. Undo it with !unblock.`,
  unblock: `${MODS_ONLY} !unblock + a name lets a blocked viewer use commands again, like !unblock @friend. Their old tasks don't come back.`,
  dw: "!dw help shows the quick start. !dw help + a command explains that one, like !dw help done. !dw commands lists them all.",
  dwhelp: "!dwhelp shows where to find every command. Just type !dwhelp.",
  dwcommands: "!dwcommands shows where to find every command. Just type !dwcommands.",
};

/** What a `!dw …` line asks for. `name` is a canonical command, or null when unknown. */
export type DwRequest =
  | { kind: "guide" }
  | { kind: "commands" }
  | { kind: "command"; name: string | null };

/** Resolves a chat command ("!t") through the streamer's aliases; commands.ts passes `resolveAlias`. */
export type AliasResolver = (command: string) => string;

/** True when `name` has a help line (own keys only, so "constructor" is not a command). */
export function hasHelpLine(name: string): boolean {
  return Object.hasOwn(COMMAND_HELP_LINES, name);
}

/**
 * Resolve a typed command name ("task", "!TASK", or one of the streamer's
 * aliases) to the canonical name a help line is keyed by, or null.
 */
export function resolveHelpTarget(raw: string, resolve: AliasResolver): string | null {
  const token = normalizeAliasToken(raw);
  if (!token) return null;
  const name = normalizeAliasToken(resolve(`!${token}`));
  return hasHelpLine(name) ? name : null;
}

/**
 * Parse the words after `!dw`. `!dw` and `!dw help` ask for the guide,
 * `!dw commands` for the full list, and `!dw help <command>` (or the shorter
 * `!dw <command>`) for one command's line.
 */
export function parseDwArgs(args: readonly string[], resolve: AliasResolver): DwRequest {
  const first = args[0]?.toLowerCase();
  if (!first) return { kind: "guide" };
  if (first === "commands") return { kind: "commands" };
  if (first === "help") {
    const target = args[1];
    return target
      ? { kind: "command", name: resolveHelpTarget(target, resolve) }
      : { kind: "guide" };
  }
  return { kind: "command", name: resolveHelpTarget(first, resolve) };
}
