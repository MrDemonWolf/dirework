import { describe, expect, it } from "vitest";

import { botConsoleStatus, botMuteStatus } from "../bot-status";

describe("botMuteStatus", () => {
  it("never says Live without a bot account", () => {
    const status = botMuteStatus({ muted: false, hasBotAccount: false });
    expect(status.tone).toBe("idle");
    expect(status.label).toBe("Off");
    expect(status.description).toMatch(/^Connect a bot account first\./);
    expect(status.description).not.toMatch(/answers chat commands while/);
  });

  it("keeps a pre-mute visible before a bot account exists", () => {
    const status = botMuteStatus({ muted: true, hasBotAccount: false });
    expect(status.tone).toBe("warn");
    expect(status.label).toBe("Muted");
    expect(status.pulse).toBe(false);
    expect(status.description).toMatch(/^Connect a bot account first\./);
  });

  it("says Unmuted, never Live, with a bot account and not muted", () => {
    // The bot runs only while its page is open, which the dashboard can't know.
    const status = botMuteStatus({ muted: false, hasBotAccount: true });
    expect(status).toMatchObject({ tone: "accent", label: "Unmuted", pulse: false });
    expect(status.description).toMatch(/while its bot page is open/);
  });

  it("is a pulsing Muted with a bot account and muted", () => {
    expect(botMuteStatus({ muted: true, hasBotAccount: true })).toMatchObject({
      tone: "warn",
      label: "Muted",
      pulse: true,
    });
  });
});

describe("botConsoleStatus", () => {
  it("only claims the URL is ready, never that the bot runs", () => {
    expect(botConsoleStatus({ hasBotAccount: true, hasBotUrl: true })).toEqual({
      tone: "accent",
      label: "URL ready",
    });
  });

  it("is not set up without an account or a URL", () => {
    for (const input of [
      { hasBotAccount: false, hasBotUrl: true },
      { hasBotAccount: true, hasBotUrl: false },
      { hasBotAccount: false, hasBotUrl: false },
    ]) {
      expect(botConsoleStatus(input)).toEqual({ tone: "idle", label: "Not set up" });
    }
  });
});
