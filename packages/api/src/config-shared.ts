// ── Pure shared config module ────────────────────────────────────────────────
// NO runtime imports of @dirework/env or @dirework/auth — this module is
// imported by Vitest (node) and by apps/web, neither of which can resolve
// cloudflare:workers. The only runtime deps are zod and the (env-free)
// @dirework/db schema/defaults modules. Type-only imports are erased and
// therefore safe. Browser-bundled constants and helpers that need neither zod
// nor the schema live in ./config-defaults, ./chat-text and ./chat-commands
// (re-exported here).
import { z } from "zod";

import type { BotConfig, TaskStyle, TimerConfig, TimerStyle } from "@dirework/db";

import type { TimerStatus } from "@dirework/db/defaults";

import {
  ALIAS_MAX_LENGTH,
  isBuiltinCommandName,
  KNOWN_ALIAS_TARGETS,
  normalizeAliasToken,
} from "./chat-commands";
import {
  hasControlCharacters,
  limitPlaceholderRepeats,
  MAX_PLACEHOLDER_REPEATS,
  mostRepeatedPlaceholder,
  sanitizeDisplayText,
  utf8ByteLength,
} from "./chat-text";
import {
  clampInt,
  clampLength,
  clampPhaseLabel,
  DEFAULT_BULLET_ICON,
  DEFAULT_TICK_ICON,
  type LengthLimit,
  lengthIssue,
  lengthIssueMessage,
  OVERLAY_ICONS,
  PHASE_LABEL_MAX_BYTES,
  PHASE_LABEL_MAX_GRAPHEMES,
  phaseLabelIssue,
  TASK_LENGTH_LIMITS,
  TASK_NUMBER_LIMITS,
  TIMER_LENGTH_LIMITS,
  TIMER_NUMBER_LIMITS,
  toOverlayIcon,
} from "./style-limits";

export {
  graphemeLength,
  hasControlCharacters,
  limitCombiningMarks,
  limitPlaceholderRepeats,
  MAX_CHAT_BYTES,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_PLACEHOLDER_REPEATS,
  sanitizeDisplayText,
  MAX_RELAYED_MESSAGE_LENGTH,
  replaceControlCharacters,
  truncateToBytes,
  truncateToLength,
  utf8ByteLength,
} from "./chat-text";
export {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_MESSAGES,
  DEFAULT_TIMER_STYLES,
  MAX_OPEN_TASKS,
  MAX_STARTED_PER_AUTHOR,
  MAX_TASK_LEN,
  TASK_LINES_MAX,
  TASK_LINES_MIN,
  clampTaskLines,
  TIMER_CONFIG_DEFAULTS,
} from "./config-defaults";
import {
  LEGACY_PHASE_LABELS,
  LEGACY_TASK_MESSAGES,
  LEGACY_TASK_STYLE_VALUES,
  LEGACY_TIMER_MESSAGES,
  LEGACY_TIMER_STYLE_VALUES,
  PHASE_LABEL_COLUMN_DEFAULTS,
  TASK_MESSAGE_COLUMN_DEFAULTS,
  TASK_STYLE_COLUMN_DEFAULTS,
  TIMER_MESSAGE_COLUMN_DEFAULTS,
  TIMER_STYLE_COLUMN_DEFAULTS,
  type StyleColumnValue,
} from "@dirework/db/defaults";
import {
  clampTaskLines,
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_MESSAGES,
  DEFAULT_TIMER_STYLES,
} from "./config-defaults";

/** Singleton-row primary key used by every one-row config table (single source: packages/db schema). */
export { SINGLETON_ID } from "@dirework/db/schema";

/** Per-user open (pending+started+active) task cap enforced on the chat ingest path. */
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
  authorization_failed:
    "Twitch refused the authorization request. Check the app's Client ID and redirect URL.",
  invalid_state: "The OAuth state was invalid.",
  state_mismatch: "The OAuth request expired.",
  session_mismatch: "Your session expired or changed during sign-in.",
  token_unavailable: "Twitch's token service didn't respond.",
  token_exchange_failed: "Twitch rejected the token exchange. Check the app's redirect URL.",
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
// Command names and the alias normalizer live in ./chat-commands (zod-free, so
// the browser bot page can filter chat without bundling zod).
export {
  ALIAS_MAX_LENGTH,
  chatCommandOf,
  cleanChatLine,
  isBuiltinCommandName,
  isDireworkCommandLine,
  KNOWN_ALIAS_TARGETS,
  MAX_BLOCKED_VIEWERS,
  META_COMMANDS,
  MODERATION_COMMANDS,
  normalizeAliasToken,
  normalizeTwitchLogin,
  TWITCH_LOGIN_PATTERN,
} from "./chat-commands";

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

/** Every timer state-machine status — defined in @dirework/db so the schema can type its columns. */
export { TIMER_STATUSES, type TimerStatus } from "@dirework/db/defaults";

// ── Shared validation primitives ────────────────────────────────────────────
// Style values are interpolated into CSS on the overlay pages, so these are
// ALLOWLISTS, not just length caps: no ";", "{", "}", "url(", backslashes or
// comments can survive them, which closes CSS injection through a saved config.
// They are deliberately permissive enough to accept every shipped default.

/**
 * #rgb / #rgba / #rrggbb / #rrggbbaa, rgb()/rgba()/hsl()/hsla(), or a safe keyword.
 * The function body is ONE character class (it already holds whitespace): a
 * leading `\s*` beside it gave the engine two ways to match every space, so a
 * long "rgb(   …" with no ")" backtracked quadratically.
 */
const CSS_COLOR_RE =
  /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|hsl)a?\([0-9.,%\s/deg]+\)|transparent|currentcolor|inherit|none|[a-z]{3,20})$/i;

/**
 * The CSS allowlists' length caps abort: validation stops at the cap, so the
 * pattern never runs on an oversized string (zod otherwise runs every check and
 * would hand the regex the whole input).
 */
const ABORT = { abort: true } as const;

export const cssColorSchema = z
  .string()
  .trim()
  .max(64, ABORT)
  .regex(CSS_COLOR_RE, "Invalid CSS color");

/**
 * A Twitch chat author color as stored on a task (IRC `color` tag: #rrggbb).
 * Persisted and interpolated into overlay CSS, so it is the ONE policy shared
 * by chat ingest and the dashboard's task restore — stricter than
 * cssColorSchema on purpose (no keywords or functions).
 */
export const twitchAuthorColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Invalid author color");

/**
 * 1–4 space-separated CSS lengths — shorthands like "12px 12px 0 0" (border
 * radius) and "10px 14px" (padding) are stored in single columns.
 */
const CSS_LENGTH_TOKEN = String.raw`(?:auto|0|[+-]?\d{1,5}(?:\.\d{1,4})?(?:px|%|r?em|v[hw]|ch|pt))`;
const CSS_LENGTH_RE = new RegExp(`^${CSS_LENGTH_TOKEN}(?: ${CSS_LENGTH_TOKEN}){0,3}$`, "i");

export const cssLengthSchema = z
  .string()
  .trim()
  .max(64, ABORT)
  .regex(CSS_LENGTH_RE, "Invalid CSS length");

/** Font family name(s). No quotes/semicolons — the overlay wraps it itself. */
export const fontFamilySchema = z
  .string()
  .trim()
  .max(120, ABORT)
  .regex(/^[a-z0-9 ,'-]+$/i, "Invalid font family");

/** A bullet or checkbox-tick icon id (OVERLAY_ICONS in ./style-limits). */
export const overlayIconSchema = z.enum(OVERLAY_ICONS);

/**
 * A CSS length held to one field's range (TIMER_/TASK_LENGTH_LIMITS in ./style-limits):
 * the allowlist above first, then the units, value count and bounds the limit accepts.
 * The Theme Center checks fields with the same `lengthIssue`, so its inline error and
 * this schema agree.
 */
export function boundedLengthSchema(limit: LengthLimit) {
  return cssLengthSchema.superRefine((value, ctx) => {
    // A value the allowlist already rejected carries that one issue, not a second.
    if (!CSS_LENGTH_RE.test(value)) return;
    const issue = lengthIssue(value, limit);
    if (issue) ctx.addIssue({ code: "custom", message: lengthIssueMessage(issue, limit) });
  });
}

/** Opacity 0–1. min/max also rejects NaN and ±Infinity. */
export const opacitySchema = z.number().min(0).max(1);

/** Bounded, finite integer helper for numeric style/config fields. */
const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);
const intIn = ([min, max]: readonly [number, number]) => boundedInt(min, max);
const timerLength = (path: keyof typeof TIMER_LENGTH_LIMITS) =>
  boundedLengthSchema(TIMER_LENGTH_LIMITS[path]).optional();
const taskLength = (path: keyof typeof TASK_LENGTH_LIMITS) =>
  boundedLengthSchema(TASK_LENGTH_LIMITS[path]).optional();

// ── Twitch protocol limits ──────────────────────────────────────────────────
// Wire limits and byte helpers live in ./chat-text (see MAX_CHAT_BYTES).

/** Max bytes for a stored message TEMPLATE, leaving room for interpolation. */
export const MAX_MESSAGE_TEMPLATE_BYTES = 300;

/**
 * A stored chat-message template, bounded by UTF-8 bytes rather than chars, with no
 * placeholder repeated more than MAX_PLACEHOLDER_REPEATS times.
 */
export const chatMessageSchema = z
  .string()
  .max(500)
  .refine((v) => !hasControlCharacters(v), {
    message: "Message must not contain control characters",
  })
  .refine((v) => utf8ByteLength(v) <= MAX_MESSAGE_TEMPLATE_BYTES, {
    message: `Message must be at most ${MAX_MESSAGE_TEMPLATE_BYTES} bytes`,
  })
  .refine((v) => (mostRepeatedPlaceholder(v)?.count ?? 0) <= MAX_PLACEHOLDER_REPEATS, {
    message: `Use each placeholder at most ${MAX_PLACEHOLDER_REPEATS} times`,
  });

/**
 * A timer phase label: at most PHASE_LABEL_MAX_GRAPHEMES user-perceived characters and
 * PHASE_LABEL_MAX_BYTES UTF-8 bytes (./style-limits), no control characters.
 */
export const phaseLabelSchema = z
  .string()
  .refine((v) => !hasControlCharacters(v), {
    message: "Label must not contain control characters",
  })
  .refine((v) => phaseLabelIssue(v) !== "graphemes", {
    message: `Label must be at most ${PHASE_LABEL_MAX_GRAPHEMES} characters`,
  })
  .refine((v) => phaseLabelIssue(v) !== "bytes", {
    message: `Label must be at most ${PHASE_LABEL_MAX_BYTES} bytes`,
  })
  // Shown on the stream: no bidi overrides, invisible characters or Zalgo stacks.
  .transform(sanitizeDisplayText);

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
  taskStarted: "msgTaskStarted",
  taskStartedFocus: "msgTaskStartedFocus",
  startCapReached: "msgStartCapReached",
  noTaskToStart: "msgNoTaskToStart",
  taskPaused: "msgTaskPaused",
  noTaskToPause: "msgNoTaskToPause",
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

export const phaseLabelsInputSchema = z.object(
  Object.fromEntries(
    Object.keys(PHASE_LABEL_FIELDS).map((key) => [key, phaseLabelSchema]),
  ) as Record<keyof typeof PHASE_LABEL_FIELDS, typeof phaseLabelSchema>,
);
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
  /** True while a mod or the owner has muted the bot (only !unmute runs). */
  muted: boolean;
  /** Lowercase Twitch logins whose commands are ignored. */
  blockedViewers: string[];
  task: TaskMessagesConfig;
  timer: TimerMessagesConfig;
}

// ── Build helpers: flat DB rows → nested frontend objects ─────────────────────

/**
 * The timer overlay styles a timer_style row stands for: never-customized values
 * upgraded to the current defaults (`upgradeLegacyStyleRow`), then nested.
 */
export function buildTimerStylesConfig(row: TimerStyle): TimerStylesConfig {
  return clampTimerStyles(
    nestTimerStyleRow(
      upgradeLegacyStyleRow(
        row,
        TIMER_STYLE_COLUMN_DEFAULTS,
        LEGACY_TIMER_STYLE_VALUES,
        CURRENT_TIMER_STYLE_ROW,
        TIMER_STYLE_GROUPS,
      ),
    ),
  );
}

/** A timer_style row as nested config, exactly as stored (no default upgrade). */
export function nestTimerStyleRow(s: TimerStyle) {
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

export type TimerStylesConfig = ReturnType<typeof nestTimerStyleRow>;

/** Task overlay counterpart of `buildTimerStylesConfig`. */
export function buildTaskStylesConfig(row: TaskStyle): TaskStylesConfig {
  return clampTaskStyles(
    nestTaskStyleRow(
      upgradeLegacyStyleRow(
        row,
        TASK_STYLE_COLUMN_DEFAULTS,
        LEGACY_TASK_STYLE_VALUES,
        CURRENT_TASK_STYLE_ROW,
        TASK_STYLE_GROUPS,
      ),
    ),
  );
}

/** A task_style row as nested config, exactly as stored (no default upgrade). */
export function nestTaskStyleRow(s: TaskStyle) {
  return {
    display: {
      showDone: s.displayShowDone,
      showCount: s.displayShowCount,
      useCheckboxes: s.displayUseCheckboxes,
      crossOnDone: s.displayCrossOnDone,
      // Rows saved under the old 1–100 range read back inside TASK_LINES_MAX.
      numberOfLines: clampTaskLines(s.displayNumberOfLines),
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
      tickIcon: toOverlayIcon(s.checkboxTickChar, DEFAULT_TICK_ICON),
      tickSize: s.checkboxTickSize,
      tickColor: s.checkboxTickColor,
    },
    bullet: {
      icon: toOverlayIcon(s.bulletChar, DEFAULT_BULLET_ICON),
      size: s.bulletSize,
      color: s.bulletColor,
      margin: { top: s.bulletMarginTop, left: s.bulletMarginLeft, right: s.bulletMarginRight },
    },
  };
}

export type TaskStylesConfig = ReturnType<typeof nestTaskStyleRow>;

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
    labels: clampPhaseLabels(
      upgradeLegacyDefaults(
        buildFromFieldMap(PHASE_LABEL_FIELDS, tc),
        DEFAULT_PHASE_LABELS,
        LEGACY_PHASE_LABEL_DEFAULTS,
      ),
    ) satisfies PhaseLabelsConfig,
  };
}

/** Every label cut to the phase label caps (rows saved before them). */
function clampPhaseLabels(labels: PhaseLabelsConfig): PhaseLabelsConfig {
  const out = { ...labels };
  for (const key of Object.keys(out) as (keyof PhaseLabelsConfig)[]) {
    out[key] = clampPhaseLabel(out[key]);
  }
  return out;
}

export type TimerConfigData = ReturnType<typeof buildTimerConfig>;

/** Per message, every default wording an earlier release could have left in the row. */
function legacyDefaultSets<K extends string>(
  column: Record<K, string>,
  legacy: Record<K, readonly string[]>,
): Record<K, ReadonlySet<string>> {
  const sets = {} as Record<K, ReadonlySet<string>>;
  for (const key of Object.keys(column) as K[]) {
    sets[key] = new Set([column[key], ...legacy[key]]);
  }
  return sets;
}

const LEGACY_TASK_DEFAULTS = legacyDefaultSets(TASK_MESSAGE_COLUMN_DEFAULTS, LEGACY_TASK_MESSAGES);
const LEGACY_TIMER_DEFAULTS = legacyDefaultSets(
  TIMER_MESSAGE_COLUMN_DEFAULTS,
  LEGACY_TIMER_MESSAGES,
);
const LEGACY_PHASE_LABEL_DEFAULTS = legacyDefaultSets(
  PHASE_LABEL_COLUMN_DEFAULTS,
  LEGACY_PHASE_LABELS,
);

/**
 * A stored reply that still holds a default from an earlier release — the frozen
 * SQL column default a fresh row starts with, or an older build's wording — reads
 * back as the CURRENT default, so rewording a default reaches every instance
 * whose owner never customized that reply: no migration, no write. Anything else
 * is the owner's own text and passes through untouched.
 */
function upgradeLegacyDefaults<K extends string>(
  messages: Record<K, string>,
  current: Record<K, string>,
  legacy: Record<K, ReadonlySet<string>>,
): Record<K, string> {
  const out = { ...messages };
  for (const key of Object.keys(messages) as K[]) {
    if (legacy[key].has(messages[key])) out[key] = current[key];
  }
  return out;
}

/** Every template with placeholders past MAX_PLACEHOLDER_REPEATS dropped (rows saved before the cap). */
function limitTemplateRepeats<K extends string>(messages: Record<K, string>): Record<K, string> {
  const out = { ...messages };
  for (const key of Object.keys(out) as K[]) {
    if (typeof out[key] === "string") out[key] = limitPlaceholderRepeats(out[key]);
  }
  return out;
}

/**
 * Stored aliases the current rules still accept (`normalizeAliases`); an alias saved
 * before a rule existed (one over ALIAS_MAX_LENGTH) is dropped on read, so it neither
 * resolves in chat nor blocks the next save of the alias list.
 */
function readAliases(stored: unknown): Record<string, string> {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const entries = Object.entries(stored).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return normalizeAliases(entries).aliases;
}

export function buildBotConfig(bc: BotConfig): BotConfigData {
  return {
    taskCommandsEnabled: bc.taskCommandsEnabled,
    timerCommandsEnabled: bc.timerCommandsEnabled,
    commandAliases: readAliases(bc.commandAliases),
    muted: bc.muted === true,
    blockedViewers: Array.isArray(bc.blockedViewers)
      ? bc.blockedViewers.filter((v): v is string => typeof v === "string")
      : [],
    task: limitTemplateRepeats(
      upgradeLegacyDefaults(
        buildFromFieldMap(TASK_MESSAGE_FIELDS, bc),
        DEFAULT_TASK_MESSAGES,
        LEGACY_TASK_DEFAULTS,
      ),
    ),
    timer: limitTemplateRepeats(
      upgradeLegacyDefaults(
        buildFromFieldMap(TIMER_MESSAGE_FIELDS, bc),
        DEFAULT_TIMER_MESSAGES,
        LEGACY_TIMER_DEFAULTS,
      ),
    ),
  };
}

// ── Style input schemas + flatten: nested objects → flat DB columns ──────────
// The zod schemas are the single source; the TS input types are z.infer'd from
// them, so the router and the TS interfaces cannot disagree on these shapes.
// Every level is optional to mirror the partial-update flatten behavior.

export const timerStylesInputSchema = z.object({
  dimensions: z
    .object({
      width: timerLength("dimensions.width"),
      height: timerLength("dimensions.height"),
    })
    .optional(),
  background: z
    .object({
      color: cssColorSchema.optional(),
      opacity: opacitySchema.optional(),
      borderRadius: timerLength("background.borderRadius"),
    })
    .optional(),
  ring: z
    .object({
      enabled: z.boolean().optional(),
      trackColor: cssColorSchema.optional(),
      trackOpacity: opacitySchema.optional(),
      fillColor: cssColorSchema.optional(),
      fillOpacity: opacitySchema.optional(),
      width: intIn(TIMER_NUMBER_LIMITS["ring.width"]).optional(),
      gap: intIn(TIMER_NUMBER_LIMITS["ring.gap"]).optional(),
    })
    .optional(),
  text: z
    .object({
      color: cssColorSchema.optional(),
      outlineColor: cssColorSchema.optional(),
      outlineSize: timerLength("text.outlineSize"),
      fontFamily: fontFamilySchema.optional(),
    })
    .optional(),
  fontSizes: z
    .object({
      label: timerLength("fontSizes.label"),
      time: timerLength("fontSizes.time"),
      cycle: timerLength("fontSizes.cycle"),
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

const borderGroupSchema = (part: "header" | "body" | "task" | "checkbox") =>
  z.object({
    color: cssColorSchema.optional(),
    width: taskLength(`${part}.border.width`),
    radius: taskLength(`${part}.border.radius`),
  });

const marginGroupSchema = (part: "checkbox" | "bullet") =>
  z.object({
    top: taskLength(`${part}.margin.top`),
    left: taskLength(`${part}.margin.left`),
    right: taskLength(`${part}.margin.right`),
  });

export const taskStylesInputSchema = z.object({
  display: z
    .object({
      showDone: z.boolean().optional(),
      showCount: z.boolean().optional(),
      useCheckboxes: z.boolean().optional(),
      crossOnDone: z.boolean().optional(),
      numberOfLines: intIn(TASK_NUMBER_LIMITS["display.numberOfLines"]).optional(),
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
      pixelsPerSecond: intIn(TASK_NUMBER_LIMITS["scroll.pixelsPerSecond"]).optional(),
      gapBetweenLoops: intIn(TASK_NUMBER_LIMITS["scroll.gapBetweenLoops"]).optional(),
    })
    .optional(),
  header: z
    .object({
      height: taskLength("header.height"),
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema("header").optional(),
      fontSize: taskLength("header.fontSize"),
      fontColor: cssColorSchema.optional(),
      padding: taskLength("header.padding"),
    })
    .optional(),
  body: z
    .object({
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema("body").optional(),
      padding: z
        .object({
          vertical: taskLength("body.padding.vertical"),
          horizontal: taskLength("body.padding.horizontal"),
        })
        .optional(),
    })
    .optional(),
  task: z
    .object({
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema("task").optional(),
      fontSize: taskLength("task.fontSize"),
      fontColor: cssColorSchema.optional(),
      usernameColor: cssColorSchema.optional(),
      padding: taskLength("task.padding"),
      marginBottom: taskLength("task.marginBottom"),
      maxWidth: taskLength("task.maxWidth"),
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
      size: taskLength("checkbox.size"),
      background: opacityGroupSchema.optional(),
      border: borderGroupSchema("checkbox").optional(),
      margin: marginGroupSchema("checkbox").optional(),
      tickIcon: overlayIconSchema.optional(),
      tickSize: taskLength("checkbox.tickSize"),
      tickColor: cssColorSchema.optional(),
    })
    .optional(),
  bullet: z
    .object({
      icon: overlayIconSchema.optional(),
      size: taskLength("bullet.size"),
      color: cssColorSchema.optional(),
      margin: marginGroupSchema("bullet").optional(),
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
    ...(input.checkbox?.tickIcon != null && { checkboxTickChar: input.checkbox.tickIcon }),
    ...(input.checkbox?.tickSize != null && { checkboxTickSize: input.checkbox.tickSize }),
    ...(input.checkbox?.tickColor != null && { checkboxTickColor: input.checkbox.tickColor }),
    ...(input.bullet?.icon != null && { bulletChar: input.bullet.icon }),
    ...(input.bullet?.size != null && { bulletSize: input.bullet.size }),
    ...(input.bullet?.color != null && { bulletColor: input.bullet.color }),
    ...(input.bullet?.margin?.top != null && { bulletMarginTop: input.bullet.margin.top }),
    ...(input.bullet?.margin?.left != null && { bulletMarginLeft: input.bullet.margin.left }),
    ...(input.bullet?.margin?.right != null && { bulletMarginRight: input.bullet.margin.right }),
  };
}

// ── Read-time upgrade of never-customized style values ───────────────────────
// Mirrors the bot-reply upgrade (`buildBotConfig`): the timer_style/task_style
// column defaults are frozen (*_STYLE_COLUMN_DEFAULTS in @dirework/db/defaults),
// so a row the owner never customized still holds them, and reads back as the
// current DEFAULT_*_STYLES instead — no migration, no write.

type StyleRow = Record<string, unknown>;

/**
 * Per style group (a top-level key of the nested config — `ring`, `fontSizes`,
 * `header`, `task`…), every column whose value is still a default from an earlier
 * release (the frozen column default or a LEGACY_* value) reads back as the
 * current default — but only when EVERY column in that group is still a default.
 * A group the owner touched is the owner's: a saved preset (Minimal Light's 1px
 * borders, Ocean Depths' 12px radii) can legitimately repeat an old default for
 * one column, and upgrading that column alone would turn the preset into a
 * hybrid no preset matches. The trade-off, same as bot replies: a whole group
 * hand-set to exactly the old defaults reads as "never customized".
 */
export function upgradeLegacyStyleRow<R extends object>(
  row: R,
  frozen: Partial<Record<keyof R, StyleColumnValue>>,
  legacy: Partial<Record<keyof R, readonly StyleColumnValue[]>>,
  current: StyleRow,
  groups: readonly (readonly string[])[],
): R {
  const stored = row as unknown as StyleRow;
  const frozenRow = frozen as StyleRow;
  const legacyRow = legacy as Partial<Record<string, readonly unknown[]>>;
  const isOldDefault = (key: string) =>
    key in frozenRow &&
    (stored[key] === frozenRow[key] || (legacyRow[key]?.includes(stored[key]) ?? false));
  const out: StyleRow = { ...stored };
  for (const group of groups) {
    if (!group.every(isOldDefault)) continue;
    for (const key of group) {
      if (key in current) out[key] = current[key];
    }
  }
  return out as R;
}

/** The column keys of each top-level style group, in config order. */
function styleGroups<C extends object>(
  defaults: C,
  flatten: (group: Partial<C>) => object,
): string[][] {
  return (Object.keys(defaults) as (keyof C)[]).map((group) =>
    Object.keys(flatten({ [group]: defaults[group] } as unknown as Partial<C>)),
  );
}

/**
 * A partial style write, widened so every group it touches is written whole: the
 * group's other columns are written at the values they READ as (old defaults
 * upgraded to current ones), then the patch is applied on top. Without this,
 * editing one field of a never-customized group would leave the rest of that
 * group on the frozen column defaults — and, the group now being customized,
 * they would stop reading as the current defaults. Untouched groups are not
 * written, so they keep picking up future default changes.
 */
function expandStylePatch(
  upgraded: StyleRow,
  patch: StyleRow,
  groups: readonly (readonly string[])[],
): StyleRow {
  const out: StyleRow = {};
  for (const group of groups) {
    if (!group.some((key) => key in patch)) continue;
    for (const key of group) {
      if (upgraded[key] !== undefined) out[key] = upgraded[key];
    }
  }
  return { ...out, ...patch };
}

/** `expandStylePatch` for a timer_style row. */
export function expandTimerStylePatch<P extends object>(row: TimerStyle, patch: P): P {
  const upgraded = upgradeLegacyStyleRow(
    row,
    TIMER_STYLE_COLUMN_DEFAULTS,
    LEGACY_TIMER_STYLE_VALUES,
    CURRENT_TIMER_STYLE_ROW,
    TIMER_STYLE_GROUPS,
  );
  return expandStylePatch(
    upgraded as unknown as StyleRow,
    patch as StyleRow,
    TIMER_STYLE_GROUPS,
  ) as P;
}

/** `expandStylePatch` for a task_style row. */
export function expandTaskStylePatch<P extends object>(row: TaskStyle, patch: P): P {
  const upgraded = upgradeLegacyStyleRow(
    row,
    TASK_STYLE_COLUMN_DEFAULTS,
    LEGACY_TASK_STYLE_VALUES,
    CURRENT_TASK_STYLE_ROW,
    TASK_STYLE_GROUPS,
  );
  return expandStylePatch(
    upgraded as unknown as StyleRow,
    patch as StyleRow,
    TASK_STYLE_GROUPS,
  ) as P;
}

// Declared after the flatten helpers they call. The build functions above read
// them only when called, never while this module is still loading.

/** DEFAULT_TIMER_STYLES as flat timer_style columns. */
export const CURRENT_TIMER_STYLE_ROW: StyleRow = flattenTimerStyles(DEFAULT_TIMER_STYLES);
/** DEFAULT_TASK_STYLES as flat task_style columns. */
export const CURRENT_TASK_STYLE_ROW: StyleRow = flattenTaskStyles(DEFAULT_TASK_STYLES);
const TIMER_STYLE_GROUPS: readonly string[][] = styleGroups(
  DEFAULT_TIMER_STYLES,
  flattenTimerStyles,
);
const TASK_STYLE_GROUPS: readonly string[][] = styleGroups(DEFAULT_TASK_STYLES, flattenTaskStyles);

// ── Read-time clamp of values saved before a limit existed ──────────────────
// Never migrated: a stored value outside today's range (a negative margin, a 300px time)
// reads back inside it, so the overlay draws it sanely and a whole-group save of the
// loaded theme never fails validation. Limits: ./style-limits.

const valueAt = (root: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], root);

function clampStyleTree<T>(
  styles: T,
  defaults: unknown,
  lengths: Readonly<Record<string, LengthLimit>>,
  numbers: Readonly<Record<string, readonly [number, number]>>,
): T {
  const out = structuredClone(styles) as Record<string, unknown>;
  const set = (path: string, value: unknown) => {
    const keys = path.split(".");
    const last = keys.pop() as string;
    const parent = keys.reduce<Record<string, unknown>>(
      (node, key) => node[key] as Record<string, unknown>,
      out,
    );
    parent[last] = value;
  };
  for (const [path, limit] of Object.entries(lengths)) {
    set(path, clampLength(valueAt(out, path) as string, limit, valueAt(defaults, path) as string));
  }
  for (const [path, range] of Object.entries(numbers)) {
    set(path, clampInt(valueAt(out, path) as number, range, valueAt(defaults, path) as number));
  }
  return out as T;
}

/** Timer styles with every length and integer inside its limit. */
export function clampTimerStyles(styles: TimerStylesConfig): TimerStylesConfig {
  return clampStyleTree(styles, DEFAULT_TIMER_STYLES, TIMER_LENGTH_LIMITS, TIMER_NUMBER_LIMITS);
}

/** Task styles with every length and integer inside its limit. */
export function clampTaskStyles(styles: TaskStylesConfig): TaskStylesConfig {
  return clampStyleTree(styles, DEFAULT_TASK_STYLES, TASK_LENGTH_LIMITS, TASK_NUMBER_LIMITS);
}
