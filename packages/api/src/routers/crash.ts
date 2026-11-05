// A capped crash report from the pages nobody watches: the OBS overlays and the bot page
// (docs/decisions/0003-client-observability.md). Their error boundaries call this direct to
// the api worker via `publicTrpc` (no cookies, no web hop), at most once per page per 10
// minutes (apps/web/src/lib/crash-report.ts), so a page stuck in a crash loop leaves one
// `client.crash` line in Workers Logs instead of nothing.

import { z } from "zod";

import { CRASH_NAME_PATTERN, CRASH_SURFACES, crashLabel, type CrashSurface } from "../crash-report";
import { publicProcedure, router } from "../index";
import type { DbClient } from "@dirework/db";
import { tokenInput, verifyBotToken, verifyOverlayToken } from "../services/tokens";

export const crashReportInput = z
  .object({
    token: tokenInput,
    surface: z.enum(CRASH_SURFACES),
    // The error's NAME only, held to telemetry's safe-token pattern: a message, a URL or a
    // stack line fails here, before the token is even read.
    name: z.string().regex(CRASH_NAME_PATTERN),
  })
  .strict();

/** The page's own gate: an overlay reports with its overlay token, the bot page with its bot token. */
function verifySurfaceToken(db: DbClient, surface: CrashSurface, token: string): Promise<boolean> {
  switch (surface) {
    case "overlay_timer":
      return verifyOverlayToken(db, "timer", token);
    case "overlay_tasks":
      return verifyOverlayToken(db, "tasks", token);
    case "bot_widget":
    case "bot_dock":
      return verifyBotToken(db, token);
  }
}

export const crashRouter = router({
  /**
   * publicProcedure, token-gated by surface. One primary-key read of instance_config, no D1
   * write, and one `client.crash` metric line through the context's `recordClientCrash` hook
   * (the api worker injects telemetry's recordMetric; packages/api never imports it). Always
   * answers null, so the call says nothing about whether the token matched.
   */
  report: publicProcedure.input(crashReportInput).mutation(async ({ ctx, input }) => {
    if (await verifySurfaceToken(ctx.db, input.surface, input.token)) {
      ctx.recordClientCrash?.(crashLabel(input.surface, input.name));
    }
    return null;
  }),
});
