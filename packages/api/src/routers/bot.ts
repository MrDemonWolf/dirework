import { TRPCError } from "@trpc/server";

import { protectedProcedure, router } from "../index";
import { botService } from "../bot/index";
import * as schema from "@dirework/db/schema";

export const botRouter = router({
  status: protectedProcedure.query(() => {
    return botService.getStatus();
  }),

  start: protectedProcedure.mutation(async ({ ctx }) => {
    if (botService.isRunning()) {
      throw new TRPCError({ code: "CONFLICT", message: "Bot is already running" });
    }

    const botAccount = await ctx.db.query.botAccount.findFirst();

    if (!botAccount) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No bot account connected" });
    }

    await botService.start(ctx.db);
    return botService.getStatus();
  }),

  stop: protectedProcedure.mutation(async () => {
    if (!botService.isRunning()) {
      throw new TRPCError({ code: "CONFLICT", message: "Bot is not running" });
    }

    await botService.stop();
    return botService.getStatus();
  }),
});
