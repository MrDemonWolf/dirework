import { z } from "zod";

import {
  MAX_TASK_LEN,
  hasControlCharacters,
  normalizeAliases,
  taskMessagesInputSchema,
  timerMessagesInputSchema,
} from "../config-shared";

// ── Router input schemas ──────────────────────────────────────────────────────
// Env-free module imported by BOTH the routers and the input-validation unit
// tests. Vitest (node) cannot load the routers themselves — the tRPC context
// chain resolves cloudflare:workers — so tests used to hand-copy these schemas
// and silently drifted from the real ones.

export const taskTextInput = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TASK_LEN)
  .refine((value) => !hasControlCharacters(value), "Control characters are not allowed");

/** Dashboard-created tasks always belong to the authenticated owner. */
export const taskCreateInput = z.object({ text: taskTextInput }).strict();

export const taskIdInput = z.object({ id: z.string().min(1).max(128) }).strict();

export const timerStartInput = z.object({
  totalCycles: z.number().int().min(1).max(99).optional(),
});

export const regenerateOverlayTokenInput = z.object({
  type: z.enum(["timer", "tasks"]),
});

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
  // empty / duplicate / recursive / unknown-target aliases via the SAME shared
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
