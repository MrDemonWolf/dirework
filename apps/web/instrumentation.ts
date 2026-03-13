export async function register() {
  // register() only runs in the Node.js runtime, not Edge — safe for db
  try {
    const { db } = await import("@dirework/db");
    const { botService } = await import("@dirework/api/bot/index");

    // Find a bot account to auto-start
    const botAccount = await db.query.botAccount.findFirst({
      columns: { userId: true },
    });

    if (botAccount && !botService.isRunning()) {
      await botService.start(db, botAccount.userId);
      console.log("[Instrumentation] Bot auto-started");
    }
  } catch (err) {
    console.error("[Instrumentation] Failed to auto-start bot:", err);
  }
}
