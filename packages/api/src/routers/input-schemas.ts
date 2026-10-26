import { z } from "zod";

import {
  MAX_TASK_LEN,
  hasControlCharacters,
  normalizeAliases,
  normalizeTwitchLogin,
  phaseLabelsInputSchema,
  taskMessagesInputSchema,
  taskStylesInputSchema,
  timerMessagesInputSchema,
  timerStylesInputSchema,
  twitchAuthorColorSchema,
} from "../config-shared";
import { MAX_TIME_ZONE_LENGTH, isValidTimeZone } from "../stats-days";

// ── Router input schemas ──────────────────────────────────────────────────────
// Env-free module imported by BOTH the routers and the input-validation unit
// tests. Vitest (node) cannot load the routers themselves — the tRPC context
// chain resolves cloudflare:workers — so keeping the schemas here lets tests
// drive the real ones instead of hand-copied mirrors that drift.

export const taskTextInput = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TASK_LEN)
  .refine((value) => !hasControlCharacters(value), "Control characters are not allowed");

/** Dashboard-created tasks always belong to the authenticated owner. */
export const taskCreateInput = z.object({ text: taskTextInput }).strict();

export const taskIdInput = z.object({ id: z.string().min(1).max(128) }).strict();

/** Timestamps arrive as the ISO strings the remove mutation serialized them to. */
const isoTimestampInput = z.iso.datetime().transform((value) => new Date(value));

/**
 * Undo of a dashboard removal: the removed row, round-tripped. Every field is
 * bounded like the paths that originally wrote it — task text by taskTextInput,
 * the author color by twitchAuthorColorSchema, the same policy chat ingest uses
 * (it reaches overlay CSS).
 */
export const taskRestoreInput = z
  .object({
    id: z.string().min(1).max(128),
    authorTwitchId: z.string().min(1).max(128),
    authorUsername: z.string().min(1).max(64),
    authorDisplayName: z.string().min(1).max(64),
    authorColor: twitchAuthorColorSchema.nullable(),
    text: taskTextInput,
    status: z.enum(["pending", "started", "active", "done"]),
    priority: z.number().int().min(0).max(1),
    order: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    createdAt: isoTimestampInput,
    completedAt: isoTimestampInput.nullable(),
  })
  .strict();

export const timerStartInput = z.object({
  totalCycles: z.number().int().min(1).max(99).optional(),
});

export const regenerateOverlayTokenInput = z.object({
  type: z.enum(["timer", "tasks"]),
});

/**
 * Dashboard setup checklist: the owner marks one step done (or not done) by
 * hand. `strict`, so a misspelled field is rejected instead of ignored.
 */
export const confirmSetupStepInput = z
  .object({
    step: z.enum(["botSource", "timerOverlay", "tasksOverlay"]),
    confirmed: z.boolean(),
  })
  .strict();

export type SetupStep = z.infer<typeof confirmSetupStepInput>["step"];

/**
 * The dashboard reports the browser's IANA zone, which decides the local day a stat lands
 * on. Only zones this runtime's Intl accepts get through, so a stored zone always formats.
 */
export const setTimeZoneInput = z
  .object({
    timeZone: z
      .string()
      .max(MAX_TIME_ZONE_LENGTH)
      .refine(isValidTimeZone, { message: "Unknown time zone" }),
  })
  .strict();

/** 24h — an upper bound on any single phase; also rejects NaN/Infinity. */
const MAX_PHASE_MS = 24 * 60 * 60 * 1000;

export const updateTimerConfigInput = z.object({
  workDuration: z.number().int().min(1000).max(MAX_PHASE_MS).optional(),
  breakDuration: z.number().int().min(1000).max(MAX_PHASE_MS).optional(),
  longBreakDuration: z.number().int().min(1000).max(MAX_PHASE_MS).optional(),
  longBreakInterval: z.number().int().min(1).max(99).optional(),
  startingDuration: z.number().int().min(0).max(MAX_PHASE_MS).optional(),
  defaultCycles: z.number().int().min(1).max(99).optional(),
  showHours: z.boolean().optional(),
  noLastBreak: z.boolean().optional(),
});

export const updateMessagesInput = z.object({
  taskCommandsEnabled: z.boolean(),
  timerCommandsEnabled: z.boolean(),
  task: taskMessagesInputSchema,
  timer: timerMessagesInputSchema,
});

export const commandAliasesInput = z.object({
  // Normalizes keys/targets to canonical form (no leading "!") and rejects
  // empty / multi-word / built-in-shadowing / duplicate / recursive /
  // unknown-target aliases via the SAME shared
  // validator the dashboard editor uses (config-shared.normalizeAliases).
  commandAliases: z
    .record(z.string().max(50), z.string().max(100))
    .refine((obj) => Object.keys(obj).length <= 50, {
      message: "Maximum of 50 command aliases allowed",
    })
    .transform((obj, ctx) => {
      const { aliases, issues } = normalizeAliases(obj);
      if (issues.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid aliases: ${issues.map((i) => `${i.key} (${i.reason})`).join(", ")}`,
        });
        return z.NEVER;
      }
      return aliases;
    }),
});

/** Whole Theme Center save — the web editor safeParses the same schema before sending. */
export const updateStylesInput = z.object({
  timerStyles: timerStylesInputSchema,
  taskStyles: taskStylesInputSchema,
  phaseLabels: phaseLabelsInputSchema,
});

/**
 * Bot settings save: any subset (at least one) of the two command switches, the Task replies,
 * the Timer replies and the aliases. Each Bot settings sub-page sends only what it edits, so
 * saving one page never writes another page's draft; a full payload is still valid. Each
 * reply group present is written whole. The web editors safeParse the same schema first.
 */
export const updateBotSettingsInput = updateMessagesInput
  .extend(commandAliasesInput.shape)
  .partial()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Nothing to save",
  });

/** Dashboard mute switch. */
export const setBotMutedInput = z.object({ muted: z.boolean() }).strict();

/**
 * A viewer to block or unblock from the dashboard. Accepts "@Name" like the
 * chat command (max 26 = "@" + a 25-char login) and normalizes through the
 * same normalizeTwitchLogin, so both paths store the same lowercase login.
 */
export const blockedViewerInput = z.object({
  login: z
    .string()
    .trim()
    .min(1)
    .max(26)
    .transform((raw, ctx) => {
      const login = normalizeTwitchLogin(raw);
      if (!login) {
        ctx.addIssue({
          code: "custom",
          message: "Use a Twitch username: letters, numbers and underscores only",
        });
        return z.NEVER;
      }
      return login;
    }),
});
