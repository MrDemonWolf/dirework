import { describe, expect, it } from "vitest";

import {
  MAX_MESSAGE_TEMPLATE_BYTES,
  chatMessageSchema,
  phaseLabelSchema,
} from "@dirework/api/config-shared";

import { messageBudget, phaseLabelBudget } from "../message-budget";

describe("messageBudget", () => {
  it("stays quiet for an ordinary template", () => {
    expect(messageBudget("Task added, {user}!")).toEqual({
      used: 19,
      max: MAX_MESSAGE_TEMPLATE_BYTES,
      unit: "bytes",
      nearLimit: false,
      over: false,
    });
  });

  it("counts UTF-8 bytes, so a short emoji template can already be over", () => {
    const emoji = "🎉".repeat(76); // 76 characters, 304 bytes
    const budget = messageBudget(emoji);
    expect(budget.used).toBe(304);
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

describe("phaseLabelBudget", () => {
  it("counts characters for plain text, from 13 of 16", () => {
    expect(phaseLabelBudget("a".repeat(12))).toMatchObject({
      used: 12,
      unit: "characters",
      nearLimit: false,
    });
    expect(phaseLabelBudget("a".repeat(13))).toMatchObject({ nearLimit: true, over: false });
    expect(phaseLabelBudget("a".repeat(17))).toMatchObject({ used: 17, over: true });
  });

  it("switches to bytes when emoji make bytes the tighter cap", () => {
    const flags = "🇺🇸".repeat(7); // 7 characters, 56 bytes
    expect(phaseLabelBudget(flags)).toMatchObject({ used: 56, max: 48, unit: "bytes", over: true });
  });

  it("agrees with the save schema", () => {
    for (const value of [
      "Pack Gathering",
      "a".repeat(16),
      "a".repeat(17),
      "🇺🇸".repeat(6),
      "🇺🇸".repeat(7),
    ]) {
      expect(phaseLabelBudget(value).over, value).toBe(!phaseLabelSchema.safeParse(value).success);
    }
  });
});
