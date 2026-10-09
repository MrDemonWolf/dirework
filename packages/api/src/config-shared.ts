// ── Pure shared config module ────────────────────────────────────────────────
// NO runtime imports of @dirework/env or @dirework/auth — this module is
// imported by Vitest (node) and by apps/web, neither of which can resolve
// cloudflare:workers. The only runtime deps are zod and the (env-free)
// @dirework/db schema/defaults modules. Type-only imports are erased and
// therefore safe. Browser-bundled constants and helpers that need neither zod
// nor the schema live in ./config-defaults and ./chat-text (re-exported here).
import { z } from "zod";

import type { BotConfig, TaskStyle, TimerConfig, TimerStyle } from "@dirework/db";

import type { TimerStatus } from "@dirework/db/defaults";

import { hasControlCharacters, utf8ByteLength } from "./chat-text";

export {
  hasControlCharacters,
  MAX_CHAT_BYTES,
  replaceControlCharacters,
  truncateToBytes,
  truncateToLength,
  utf8ByteLength,
} from "./chat-text";
export {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TIMER_MESSAGES,
  MAX_TASK_LEN,
  TIMER_CONFIG_DEFAULTS,
} from "./config-defaults";

/** Singleton-row primary key used by every one-row config table (single source: packages/db schema). */
export { SINGLETON_ID } from "@dirework/db/schema";

/** Per-user open (pending+active) task cap enforced on the chat ingest path. */
export const CHAT_OPEN_TASK_CAP = 20;

/**
 * Max procedures in one tRPC batch request. The rate limiter charges a whole
 * request once, so an unbounded batch would let one request run hundreds of
 * procedures. The server rejects larger batches; client links split at it.
 */
export const TRPC_MAX_BATCH_SIZE = 10;

/**
 * PRECONDITION_FAILED message for a bot login that can no longer be refreshed.
 * The bot page matches on it (not the bare code) to show the reconnect screen.
 */
export const BOT_REAUTH_REQUIRED_MESSAGE =
  "Twitch token refresh failed — reconnect the bot account";

// ── Bot OAuth callback errors ────────────────────────────────────────────────
// The bot OAuth callback redirects to `/dashboard/bot?bot=error&reason=<code>`.
// The dashboard maps the code to fixed copy and never renders the raw query
// param, so a crafted link can't put attacker-written text in an error toast.
export const BOT_OAUTH_ERROR_MESSAGES = {
  access_denied: "Twitch authorization was cancelled.",
  missing_params: "Twitch didn't return an authorization code.",
  invalid_state: "The OAuth state was invalid.",
  state_mismatch: "The OAuth request expired.",
  session_mismatch: "Your session expired or changed during sign-in.",
  token_unavailable: "Twitch's token service didn't respond.",
  token_exchange_failed: "Twitch rejected the token exchange — check the app's redirect URL.",
  invalid_token_response: "Twitch returned an invalid token response.",
  user_unavailable: "Twitch's user service didn't respond.",
  user_lookup_failed: "Couldn't look up the bot account on Twitch.",
  invalid_user_response: "Twitch returned no valid user data.",
  db_error: "The bot account couldn't be saved.",
} as const;

export type BotOAuthErrorCode = keyof typeof BOT_OAUTH_ERROR_MESSAGES;

/** Fixed toast copy for a `?reason=` code; unknown or missing codes get a generic message. */
export function botOAuthErrorMessage(code: string | null | undefined): string {
  const detail =
    code && Object.hasOwn(BOT_OAUTH_ERROR_MESSAGES, code)
      ? BOT_OAUTH_ERROR_MESSAGES[code as BotOAuthErrorCode]
      : "Something went wrong.";
  return `Couldn't connect the bot account. ${detail} Try again.`;
}

// ── Command aliases (single source, env-free) ────────────────────────────────
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
 * True when an alias or target is more than one word ("!timer start"). Aliases
 * map one command name to another and carry no arguments, so normalizing would
 * silently drop everything after the first word.
 */
export function aliasTokenHasWhitespace(raw: string): boolean {
  return /\s/.test(raw.trim().replace(/^!+/, "").trim());
}

export type AliasIssueReason =
  | "empty"
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
 * tokens, multi-word keys/targets, keys that would replace a built-in command,
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

/** Every timer state-machine status — defined in @dirework/db so the schema can type its columns. */
export { TIMER_STATUSES, type TimerStatus } from "@dirework/db/defaults";

// ── Shared validation primitives ────────────────────────────────────────────
// Style values are interpolated into CSS on the overlay pages, so these are
// ALLOWLISTS, not just length caps: no ";", "{", "}", "url(", backslashes or
// comments can survive them, which closes CSS injection through a saved config.
// They are deliberately permissive enough to accept every shipped default.

/** #rgb / #rgba / #rrggbb / #rrggbbaa, rgb()/rgba()/hsl()/hsla(), or a safe keyword. */
const CSS_COLOR_RE =
  /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|hsl)a?\(\s*[0-9.,%\s/deg]+\)|transparent|currentcolor|inherit|none|[a-z]{3,20})$/i;

export const cssColorSchema = z.string().trim().max(64).regex(CSS_COLOR_RE, "Invalid CSS color");

/**
 * 1–4 space-separated CSS lengths — shorthands like "12px 12px 0 0" (border
 * radius) and "10px 14px" (padding) are stored in single columns.
 */
const CSS_LENGTH_TOKEN = String.raw`(?:auto|0|[+-]?\d{1,5}(?:\.\d{1,4})?(?:px|%|r?em|v[hw]|ch|pt))`;
const CSS_LENGTH_RE = new RegExp(`^${CSS_LENGTH_TOKEN}(?: ${CSS_LENGTH_TOKEN}){0,3}$`, "i");

export const cssLengthSchema = z.string().trim().max(64).regex(CSS_LENGTH_RE, "Invalid CSS length");

/** Font family name(s). No quotes/semicolons — the overlay wraps it itself. */
export const fontFamilySchema = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-z0-9 ,'-]+$/i, "Invalid font family");

/** A single decorative glyph (bullet "•", tick "✔"). */
export const glyphSchema = z.string().min(1).max(8);

/** Opacity 0–1. min/max also rejects NaN and ±Infinity. */
export const opacitySchema = z.number().min(0).max(1);

/** Bounded, finite integer helper for numeric style/config fields. */
const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);

// ── Twitch protocol limits ──────────────────────────────────────────────────
// Wire limits and byte helpers live in ./chat-text (see MAX_CHAT_BYTES).

/** Max bytes for a stored message TEMPLATE, leaving room for interpolation. */
export const MAX_MESSAGE_TEMPLATE_BYTES = 300;

/** A stored chat-message template, bounded by UTF-8 bytes rather than chars. */
export const chatMessageSchema = z
  .string()
  .max(500)
  .refine((v) => !hasControlCharacters(v), {
    message: "Message must not contain control characters",
  })
  .refine((v) => utf8ByteLength(v) <= MAX_MESSAGE_TEMPLATE_BYTES, {
    message: `Message must be at most ${MAX_MESSAGE_TEMPLATE_BYTES} bytes`,
  });

// ── Field maps: nested config keys ↔ flat DB columns (single source) ─────────
// Build and flatten are both generated from these maps, so they cannot drift.

export const PHASE_LABEL_FIELDS = {
  idle: "labelIdle",
  starting: "labelStarting",
  work: "labelWork",
  break: "labelBreak",
  longBreak: "labelLongBreak",
  paused: "labelPaused",
  finished: "labelFinished",
} as const satisfies Record<TimerStatus, keyof TimerConfig>;

export const TASK_MESSAGE_FIELDS = {
  taskAdded: "msgTaskAdded",
  noTaskAdded: "msgNoTaskAdded",
  noTaskContent: "msgNoTaskContent",
  noTaskToEdit: "msgNoTaskToEdit",
  taskEdited: "msgTaskEdited",
  taskRemoved: "msgTaskRemoved",
  taskNext: "msgTaskNext",
  adminDeleteTasks: "msgAdminDeleteTasks",
  taskDone: "msgTaskDone",
  taskCheck: "msgTaskCheck",
  taskCheckUser: "msgTaskCheckUser",
  noTask: "msgNoTask",
  noTaskOther: "msgNoTaskOther",
  notMod: "msgNotMod",
  clearedAll: "msgClearedAll",
  clearedDone: "msgClearedDone",
  nextNoContent: "msgNextNoContent",
  help: "msgHelp",
} as const satisfies Record<string, keyof BotConfig>;

// Only messages with a real emit site in bot/commands.ts belong here — see the
// note on DEFAULT_TIMER_MESSAGES about the phase-announcement fields removed in
// the P1 cleanup (nothing on Workers could ever fire them).
export const TIMER_MESSAGE_FIELDS = {
  notRunning: "msgNotRunning",
  wrongCommand: "msgWrongCommand",
  timerRunning: "msgTimerRunning",
  commandSuccess: "msgCommandSuccess",
  cycleWrong: "msgCycleWrong",
  eta: "msgEta",
} as const satisfies Record<string, keyof BotConfig>;

/** Nested config object (field-map keys) from a flat DB row (field-map columns). */
export function buildFromFieldMap<M extends Record<string, string>>(
  map: M,
  row: Record<M[keyof M], string>,
): Record<keyof M, string> {
  const out = {} as Record<keyof M, string>;
  for (const key of Object.keys(map) as (keyof M & string)[]) {
    out[key] = row[map[key] as M[keyof M]];
  }
  return out;
}

/** Flat DB column patch (field-map columns) from a nested config object (field-map keys). */
export function flattenWithFieldMap<M extends Record<string, string>>(
  map: M,
  values: Record<keyof M, string>,
): Record<M[keyof M], string> {
  const out = {} as Record<M[keyof M], string>;
  for (const key of Object.keys(map) as (keyof M & string)[]) {
    out[map[key] as M[keyof M]] = values[key];
  }
  return out;
}

/**
 * z.object with one bounded message field per field-map key — router inputs
 * derive from the same maps. Fields are capped by UTF-8 BYTES (not characters)
 * so a template of multi-byte glyphs can't blow past the IRC line limit once
 * interpolated. See chatMessageSchema.
 */
function stringSchemaFromFieldMap<M extends Record<string, string>>(map: M) {
  const shape = Object.fromEntries(
    Object.keys(map).map((key) => [key, chatMessageSchema]),
  ) as Record<keyof M & string, typeof chatMessageSchema>;
  return z.object(shape);
}

export const phaseLabelsInputSchema = stringSchemaFromFieldMap(PHASE_LABEL_FIELDS);
export const taskMessagesInputSchema = stringSchemaFromFieldMap(TASK_MESSAGE_FIELDS);
export const timerMessagesInputSchema = stringSchemaFromFieldMap(TIMER_MESSAGE_FIELDS);

// ── Shared config types (single source of truth — apps/web imports these) ────

export type PhaseLabelsConfig = Record<keyof typeof PHASE_LABEL_FIELDS, string>;
export type TaskMessagesConfig = Record<keyof typeof TASK_MESSAGE_FIELDS, string>;
export type TimerMessagesConfig = Record<keyof typeof TIMER_MESSAGE_FIELDS, string>;

export interface BotConfigData {
  taskCommandsEnabled: boolean;
  timerCommandsEnabled: boolean;
  commandAliases: Record<string, string>;
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

// ── Build helpers: flat DB rows → nested frontend objects ─────────────────────

export function buildTimerStylesConfig(s: TimerStyle) {
  return {
    dimensions: { width: s.width, height: s.height },
    background: { color: s.bgColor, opacity: s.bgOpacity, borderRadius: s.bgBorderRadius },
    ring: {
      enabled: s.ringEnabled,
      trackColor: s.ringTrackColor,
      trackOpacity: s.ringTrackOpacity,
      fillColor: s.ringFillColor,
      fillOpacity: s.ringFillOpacity,
      width: s.ringWidth,
      gap: s.ringGap,
    },
    text: {
      color: s.textColor,
      outlineColor: s.textOutlineColor,
      outlineSize: s.textOutlineSize,
      fontFamily: s.textFontFamily,
    },
    fontSizes: { label: s.fontSizeLabel, time: s.fontSizeTime, cycle: s.fontSizeCycle },
  };
}

export type TimerStylesConfig = ReturnType<typeof buildTimerStylesConfig>;

export function buildTaskStylesConfig(s: TaskStyle) {
  return {
    display: {
      showDone: s.displayShowDone,
      showCount: s.displayShowCount,
      useCheckboxes: s.displayUseCheckboxes,
      crossOnDone: s.displayCrossOnDone,
      numberOfLines: s.displayNumberOfLines,
    },
    fonts: { header: s.fontHeader, body: s.fontBody },
    scroll: {
      enabled: s.scrollEnabled,
      pixelsPerSecond: s.scrollPixelsPerSecond,
      gapBetweenLoops: s.scrollGapBetweenLoops,
    },
    header: {
      height: s.headerHeight,
      background: { color: s.headerBgColor, opacity: s.headerBgOpacity },
      border: {
        color: s.headerBorderColor,
        width: s.headerBorderWidth,
        radius: s.headerBorderRadius,
      },
      fontSize: s.headerFontSize,
      fontColor: s.headerFontColor,
      padding: s.headerPadding,
    },
    body: {
      background: { color: s.bodyBgColor, opacity: s.bodyBgOpacity },
      border: { color: s.bodyBorderColor, width: s.bodyBorderWidth, radius: s.bodyBorderRadius },
      padding: { vertical: s.bodyPaddingVertical, horizontal: s.bodyPaddingHorizontal },
    },
    task: {
      background: { color: s.taskBgColor, opacity: s.taskBgOpacity },
      border: { color: s.taskBorderColor, width: s.taskBorderWidth, radius: s.taskBorderRadius },
      fontSize: s.taskFontSize,
      fontColor: s.taskFontColor,
      usernameColor: s.taskUsernameColor,
      padding: s.taskPadding,
      marginBottom: s.taskMarginBottom,
      maxWidth: s.taskMaxWidth,
    },
    taskDone: {
      background: { color: s.taskDoneBgColor, opacity: s.taskDoneBgOpacity },
      fontColor: s.taskDoneFontColor,
    },
    checkbox: {
      size: s.checkboxSize,
      background: { color: s.checkboxBgColor, opacity: s.checkboxBgOpacity },
      border: {
        color: s.checkboxBorderColor,
        width: s.checkboxBorderWidth,
        radius: s.checkboxBorderRadius,
      },
      margin: {
        top: s.checkboxMarginTop,
        left: s.checkboxMarginLeft,
        right: s.checkboxMarginRight,
      },
      tickChar: s.checkboxTickChar,
      tickSize: s.checkboxTickSize,
      tickColor: s.checkboxTickColor,
    },
    bullet: {
      char: s.bulletChar,
      size: s.bulletSize,
      color: s.bulletColor,
      margin: { top: s.bulletMarginTop, left: s.bulletMarginLeft, right: s.bulletMarginRight },
    },
  };
}

export type TaskStylesConfig = ReturnType<typeof buildTaskStylesConfig>;

export function buildTimerConfig(tc: TimerConfig) {
  return {
    workDuration: tc.workDuration,
    breakDuration: tc.breakDuration,
    longBreakDuration: tc.longBreakDuration,
    longBreakInterval: tc.longBreakInterval,
    startingDuration: tc.startingDuration,
    defaultCycles: tc.defaultCycles,
    showHours: tc.showHours,
    noLastBreak: tc.noLastBreak,
    labels: buildFromFieldMap(PHASE_LABEL_FIELDS, tc) satisfies PhaseLabelsConfig,
  };
}

export type TimerConfigData = ReturnType<typeof buildTimerConfig>;

export function buildBotConfig(bc: BotConfig): BotConfigData {
  return {
    taskCommandsEnabled: bc.taskCommandsEnabled,
    timerCommandsEnabled: bc.timerCommandsEnabled,
    commandAliases: bc.commandAliases as Record<string, string>,
    task: buildFromFieldMap(TASK_MESSAGE_FIELDS, bc),
    timer: buildFromFieldMap(TIMER_MESSAGE_FIELDS, bc),
  };
}

// ── Style input schemas + flatten: nested objects → flat DB columns ──────────
// The zod schemas are the single source; the TS input types are z.infer'd from
// them, so the router and the TS interfaces cannot disagree on these shapes.
// Every level is optional to mirror the partial-update flatten behavior.

export const timerStylesInputSchema = z.object({
  dimensions: z
    .object({
      width: cssLengthSchema.optional(),
      height: cssLengthSchema.optional(),
    })
    .optional(),
  background: z
    .object({
      color: cssColorSchema.optional(),
      opacity: opacitySchema.optional(),
      borderRadius: cssLengthSchema.optional(),
    })
    .optional(),
  ring: z
    .object({
      enabled: z.boolean().optional(),
      trackColor: cssColorSchema.optional(),
      trackOpacity: opacitySchema.optional(),
      fillColor: cssColorSchema.optional(),
      fillOpacity: opacitySchema.optional(),
      width: boundedInt(0, 200).optional(),
      gap: boundedInt(0, 200).optional(),
    })
    .optional(),
  text: z
    .object({
      color: cssColorSchema.optional(),
      outlineColor: cssColorSchema.optional(),
      outlineSize: cssLengthSchema.optional(),
      fontFamily: fontFamilySchema.optional(),
    })
    .optional(),
  fontSizes: z
    .object({
      label: cssLengthSchema.optional(),
      time: cssLengthSchema.optional(),
      cycle: cssLengthSchema.optional(),
    })
    .optional(),
});

export type TimerStylesInput = z.infer<typeof timerStylesInputSchema>;

export function flattenTimerStyles(input: TimerStylesInput) {
  return {
    ...(input.dimensions?.width != null && { width: input.dimensions.width }),
    ...(input.dimensions?.height != null && { height: input.dimensions.height }),
    ...(input.background?.color != null && { bgColor: input.background.color }),
    ...(input.background?.opacity != null && { bgOpacity: input.background.opacity }),
    ...(input.background?.borderRadius != null && {
      bgBorderRadius: input.background.borderRadius,
    }),
    ...(input.ring?.enabled != null && { ringEnabled: input.ring.enabled }),
    ...(input.ring?.trackColor != null && { ringTrackColor: input.ring.trackColor }),
    ...(input.ring?.trackOpacity != null && { ringTrackOpacity: input.ring.trackOpacity }),
    ...(input.ring?.fillColor != null && { ringFillColor: input.ring.fillColor }),
    ...(input.ring?.fillOpacity != null && { ringFillOpacity: input.ring.fillOpacity }),
    ...(input.ring?.width != null && { ringWidth: input.ring.width }),
    ...(input.ring?.gap != null && { ringGap: input.ring.gap }),
    ...(input.text?.color != null && { textColor: input.text.color }),
    ...(input.text?.outlineColor != null && { textOutlineColor: input.text.outlineColor }),
    ...(input.text?.outlineSize != null && { textOutlineSize: input.text.outlineSize }),
    ...(input.text?.fontFamily != null && { textFontFamily: input.text.fontFamily }),
    ...(input.fontSizes?.label != null && { fontSizeLabel: input.fontSizes.label }),
    ...(input.fontSizes?.time != null && { fontSizeTime: input.fontSizes.time }),
    ...(input.fontSizes?.cycle != null && { fontSizeCycle: input.fontSizes.cycle }),
  };
}

const opacityGroupSchema = z.object({
  color: cssColorSchema.optional(),
  opacity: opacitySchema.optional(),
});

const borderGroupSchema = z.object({
  color: cssColorSchema.optional(),
  width: cssLengthSchema.optional(),
  radius: cssLengthSchema.optional(),
});

const marginGroupSchema = z.object({
  top: cssLengthSchema.optional(),
  left: cssLengthSchema.optional(),
  right: cssLengthSchema.optional(),
});

export const taskStylesInputSchema = z.object({
  display: z
    .object({
      showDone: z.boolean().optional(),
      showCount: z.boolean().optional(),
      useCheckboxes: z.boolean().optional(),
      crossOnDone: z.boolean().optional(),
      numberOfLines: boundedInt(1, 100).optional(),
    })
    .optional(),
  fonts: z
    .object({
      header: fontFamilySchema.optional(),
      body: fontFamilySchema.optional(),
    })
    .optional(),
  scroll: z
    .object({
      enabled: z.boolean().optional(),
      pixelsPerSecond: boundedInt(1, 1000).optional(),
      gapBetweenLoops: boundedInt(0, 5000).optional(),
    })
    .optional(),
  header: z
    .object({
      height: cssLengthSchema.optional(),
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema.optional(),
      fontSize: cssLengthSchema.optional(),
      fontColor: cssColorSchema.optional(),
      padding: cssLengthSchema.optional(),
    })
    .optional(),
  body: z
    .object({
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema.optional(),
      padding: z
        .object({
          vertical: cssLengthSchema.optional(),
          horizontal: cssLengthSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  task: z
    .object({
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema.optional(),
      fontSize: cssLengthSchema.optional(),
      fontColor: cssColorSchema.optional(),
      usernameColor: cssColorSchema.optional(),
      padding: cssLengthSchema.optional(),
      marginBottom: cssLengthSchema.optional(),
      maxWidth: cssLengthSchema.optional(),
    })
    .optional(),
  taskDone: z
    .object({
      background: opacityGroupSchema.optional(),
      fontColor: cssColorSchema.optional(),
    })
    .optional(),
  checkbox: z
    .object({
      size: cssLengthSchema.optional(),
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema.optional(),
      margin: marginGroupSchema.optional(),
      tickChar: glyphSchema.optional(),
      tickSize: cssLengthSchema.optional(),
      tickColor: cssColorSchema.optional(),
    })
    .optional(),
  bullet: z
    .object({
      char: glyphSchema.optional(),
      size: cssLengthSchema.optional(),
      color: cssColorSchema.optional(),
      margin: marginGroupSchema.optional(),
    })
    .optional(),
});

export type TaskStylesInput = z.infer<typeof taskStylesInputSchema>;

export function flattenTaskStyles(input: TaskStylesInput) {
  return {
    ...(input.display?.showDone != null && { displayShowDone: input.display.showDone }),
    ...(input.display?.showCount != null && { displayShowCount: input.display.showCount }),
    ...(input.display?.useCheckboxes != null && {
      displayUseCheckboxes: input.display.useCheckboxes,
    }),
    ...(input.display?.crossOnDone != null && { displayCrossOnDone: input.display.crossOnDone }),
    ...(input.display?.numberOfLines != null && {
      displayNumberOfLines: input.display.numberOfLines,
    }),
    ...(input.fonts?.header != null && { fontHeader: input.fonts.header }),
    ...(input.fonts?.body != null && { fontBody: input.fonts.body }),
    ...(input.scroll?.enabled != null && { scrollEnabled: input.scroll.enabled }),
    ...(input.scroll?.pixelsPerSecond != null && {
      scrollPixelsPerSecond: input.scroll.pixelsPerSecond,
    }),
    ...(input.scroll?.gapBetweenLoops != null && {
      scrollGapBetweenLoops: input.scroll.gapBetweenLoops,
    }),
    ...(input.header?.height != null && { headerHeight: input.header.height }),
    ...(input.header?.background?.color != null && {
      headerBgColor: input.header.background.color,
    }),
    ...(input.header?.background?.opacity != null && {
      headerBgOpacity: input.header.background.opacity,
    }),
    ...(input.header?.border?.color != null && { headerBorderColor: input.header.border.color }),
    ...(input.header?.border?.width != null && { headerBorderWidth: input.header.border.width }),
    ...(input.header?.border?.radius != null && { headerBorderRadius: input.header.border.radius }),
    ...(input.header?.fontSize != null && { headerFontSize: input.header.fontSize }),
    ...(input.header?.fontColor != null && { headerFontColor: input.header.fontColor }),
    ...(input.header?.padding != null && { headerPadding: input.header.padding }),
    ...(input.body?.background?.color != null && { bodyBgColor: input.body.background.color }),
    ...(input.body?.background?.opacity != null && {
      bodyBgOpacity: input.body.background.opacity,
    }),
    ...(input.body?.border?.color != null && { bodyBorderColor: input.body.border.color }),
    ...(input.body?.border?.width != null && { bodyBorderWidth: input.body.border.width }),
    ...(input.body?.border?.radius != null && { bodyBorderRadius: input.body.border.radius }),
    ...(input.body?.padding?.vertical != null && {
      bodyPaddingVertical: input.body.padding.vertical,
    }),
    ...(input.body?.padding?.horizontal != null && {
      bodyPaddingHorizontal: input.body.padding.horizontal,
    }),
    ...(input.task?.background?.color != null && { taskBgColor: input.task.background.color }),
    ...(input.task?.background?.opacity != null && {
      taskBgOpacity: input.task.background.opacity,
    }),
    ...(input.task?.border?.color != null && { taskBorderColor: input.task.border.color }),
    ...(input.task?.border?.width != null && { taskBorderWidth: input.task.border.width }),
    ...(input.task?.border?.radius != null && { taskBorderRadius: input.task.border.radius }),
    ...(input.task?.fontSize != null && { taskFontSize: input.task.fontSize }),
    ...(input.task?.fontColor != null && { taskFontColor: input.task.fontColor }),
    ...(input.task?.usernameColor != null && { taskUsernameColor: input.task.usernameColor }),
    ...(input.task?.padding != null && { taskPadding: input.task.padding }),
    ...(input.task?.marginBottom != null && { taskMarginBottom: input.task.marginBottom }),
    ...(input.task?.maxWidth != null && { taskMaxWidth: input.task.maxWidth }),
    ...(input.taskDone?.background?.color != null && {
      taskDoneBgColor: input.taskDone.background.color,
    }),
    ...(input.taskDone?.background?.opacity != null && {
      taskDoneBgOpacity: input.taskDone.background.opacity,
    }),
    ...(input.taskDone?.fontColor != null && { taskDoneFontColor: input.taskDone.fontColor }),
    ...(input.checkbox?.size != null && { checkboxSize: input.checkbox.size }),
    ...(input.checkbox?.background?.color != null && {
      checkboxBgColor: input.checkbox.background.color,
    }),
    ...(input.checkbox?.background?.opacity != null && {
      checkboxBgOpacity: input.checkbox.background.opacity,
    }),
    ...(input.checkbox?.border?.color != null && {
      checkboxBorderColor: input.checkbox.border.color,
    }),
    ...(input.checkbox?.border?.width != null && {
      checkboxBorderWidth: input.checkbox.border.width,
    }),
    ...(input.checkbox?.border?.radius != null && {
      checkboxBorderRadius: input.checkbox.border.radius,
    }),
    ...(input.checkbox?.margin?.top != null && { checkboxMarginTop: input.checkbox.margin.top }),
    ...(input.checkbox?.margin?.left != null && { checkboxMarginLeft: input.checkbox.margin.left }),
    ...(input.checkbox?.margin?.right != null && {
      checkboxMarginRight: input.checkbox.margin.right,
    }),
    ...(input.checkbox?.tickChar != null && { checkboxTickChar: input.checkbox.tickChar }),
    ...(input.checkbox?.tickSize != null && { checkboxTickSize: input.checkbox.tickSize }),
    ...(input.checkbox?.tickColor != null && { checkboxTickColor: input.checkbox.tickColor }),
    ...(input.bullet?.char != null && { bulletChar: input.bullet.char }),
    ...(input.bullet?.size != null && { bulletSize: input.bullet.size }),
    ...(input.bullet?.color != null && { bulletColor: input.bullet.color }),
    ...(input.bullet?.margin?.top != null && { bulletMarginTop: input.bullet.margin.top }),
    ...(input.bullet?.margin?.left != null && { bulletMarginLeft: input.bullet.margin.left }),
    ...(input.bullet?.margin?.right != null && { bulletMarginRight: input.bullet.margin.right }),
  };
}
