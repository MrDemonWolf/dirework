export async function register() {
  // register() only runs in the Node.js runtime, not Edge — safe for db
  try {
    const { db } = await import("@dirework/db");
    const { botService } = await import("@dirework/api/bot/index");
    const { logger } = await import("@dirework/api/logger");

    // Find a bot account to auto-start (single-user-per-instance app)
    const botAccount = await db.query.botAccount.findFirst({
      columns: { id: true },
    });

    if (botAccount && !botService.isRunning()) {
      await botService.start(db);
      logger.info("[Instrumentation] Bot auto-started");
    }
  } catch (err) {
    const { logger } = await import("@dirework/api/logger").catch(() => ({
      logger: { error: console.error },
    }));
    logger.error("[Instrumentation] Failed to auto-start bot:", err);
  }
}
