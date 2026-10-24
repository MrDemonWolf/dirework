import { describe, expect, it } from "vitest";

import { activeBotSection, BOT_SECTIONS } from "@/lib/bot-sections";

describe("activeBotSection", () => {
  it("matches each section on its own path", () => {
    for (const section of BOT_SECTIONS) {
      expect(activeBotSection(section.href)).toBe(section);
    }
  });

  it("never marks Overview active on another section's path", () => {
    expect(activeBotSection("/dashboard/bot/moderation")?.label).toBe("Moderation");
    expect(activeBotSection("/dashboard/bot/commands/")?.label).toBe("Commands");
  });

  it("is null outside Bot settings and on look-alike paths", () => {
    expect(activeBotSection("/dashboard")).toBeNull();
    expect(activeBotSection("/dashboard/botany")).toBeNull();
    expect(activeBotSection("/dashboard/styles")).toBeNull();
  });

  it("starts with Overview, the page the bot OAuth flow returns to", () => {
    expect(BOT_SECTIONS[0]?.href).toBe("/dashboard/bot");
  });
});
