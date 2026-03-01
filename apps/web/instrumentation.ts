export async function onRequestInit() {
  // Only auto-start once (on first request after server boot)
  if ((globalThis as Record<string, unknown>).__botAutoStarted) return;
  (globalThis as Record<string, unknown>).__botAutoStarted = true;

  try {
    const { default: prisma } = await import("@dirework/db");
    const { botService } = await import("@dirework/api/bot/index");

    // Find a bot account to auto-start
    const botAccount = await prisma.botAccount.findFirst({
      select: { userId: true },
    });

    if (botAccount && !botService.isRunning()) {
      await botService.start(prisma, botAccount.userId);
      console.log("[Instrumentation] Bot auto-started");
    }
  } catch (err) {
    console.error("[Instrumentation] Failed to auto-start bot:", err);
  }
}
