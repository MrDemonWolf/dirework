import { z } from "zod";

import {
  MAX_TASK_LEN,
  normalizeAliases,
  taskMessagesInputSchema,
  timerMessagesInputSchema,
} from "../config-shared";

// ── Router input schemas ──────────────────────────────────────────────────────
// Env-free module imported by BOTH the routers and the input-validation unit
// tests. Vitest (node) cannot load the routers themselves — the tRPC context
// chain resolves cloudflare:workers — so tests used to hand-copy these schemas
// and silently drifted from the real ones.

export const taskTextInput = z.string().min(1).max(MAX_TASK_LEN);

export const taskCreateInput = z.object({
  authorTwitchId: z.string(),
  authorUsername: z.string(),
  authorDisplayName: z.string(),
  authorColor: z.string().optional(),
  text: taskTextInput,
});

export const taskIdInput = z.object({ id: z.string() });

export const timerStartInput = z.object({
  totalCycles: z.number().int().min(1).max(99).optional(),
});

export const regenerateOverlayTokenInput = z.object({
  type: z.enum(["timer", "tasks"]),
});

export const updateTimerConfigInput = z.object({
  workDuration: z.number().int().min(1000).optional(),
  breakDuration: z.number().int().min(1000).optional(),
  longBreakDuration: z.number().int().min(1000).optional(),
  longBreakInterval: z.number().int().min(1).optional(),
  startingDuration: z.number().int().min(0).optional(),
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
