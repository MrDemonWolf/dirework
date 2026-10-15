import { describe, expect, it } from "vitest";

import { BOT_OAUTH_ERROR_MESSAGES, botOAuthErrorMessage } from "../../config-shared";

describe("botOAuthErrorMessage", () => {
  it("maps a known reason code to its fixed copy", () => {
    expect(botOAuthErrorMessage("access_denied")).toBe(
      `Couldn't connect the bot account. ${BOT_OAUTH_ERROR_MESSAGES.access_denied} Try again.`,
    );
  });

  it.each([
    "Twitch suspended your bot - re-verify at evil.example",
    "toString",
    "__proto__",
    "",
    null,
    undefined,
  ])("never echoes an unknown or missing reason (%j)", (reason) => {
    const message = botOAuthErrorMessage(reason);
    expect(message).toBe("Couldn't connect the bot account. Something went wrong. Try again.");
  });
});
