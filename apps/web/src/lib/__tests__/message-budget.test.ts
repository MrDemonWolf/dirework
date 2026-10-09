import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_TEMPLATE_BYTES, chatMessageSchema } from "@dirework/api/config-shared";

import { messageBudget } from "../message-budget";

describe("messageBudget", () => {
  it("stays quiet for an ordinary template", () => {
    expect(messageBudget("Task added, {user}!")).toEqual({
      bytes: 19,
      max: MAX_MESSAGE_TEMPLATE_BYTES,
      nearLimit: false,
      over: false,
    });
  });

  it("counts UTF-8 bytes, so a short emoji template can already be over", () => {
    const emoji = "🎉".repeat(76); // 76 characters, 304 bytes
    const budget = messageBudget(emoji);
    expect(budget.bytes).toBe(304);
    expect(budget.nearLimit).toBe(true);
    expect(budget.over).toBe(true);
    // Agrees with the server's own schema on where the line is.
    expect(chatMessageSchema.safeParse(emoji).success).toBe(false);
    expect(chatMessageSchema.safeParse("🎉".repeat(75)).success).toBe(true);
    expect(messageBudget("🎉".repeat(75)).over).toBe(false);
  });

  it("shows the counter from 80% of the budget", () => {
    const threshold = Math.ceil(MAX_MESSAGE_TEMPLATE_BYTES * 0.8);
    expect(messageBudget("a".repeat(threshold - 1)).nearLimit).toBe(false);
    expect(messageBudget("a".repeat(threshold)).nearLimit).toBe(true);
  });
});
