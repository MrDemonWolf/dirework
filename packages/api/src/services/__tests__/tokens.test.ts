import { describe, expect, it } from "vitest";

import type { DbClient } from "@dirework/db";

import { constantTimeEqual, verifyBotToken, verifyOverlayToken } from "../tokens";

function makeDb(instance: Record<string, string> | undefined) {
  return {
    query: {
      instanceConfig: {
        findFirst: async () => instance,
      },
    },
  } as unknown as DbClient;
}

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc-123", "abc-123")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(constantTimeEqual("abc-123", "abc-124")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("handles UUIDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(constantTimeEqual(uuid, uuid)).toBe(true);
    expect(constantTimeEqual(uuid, uuid.replace("0", "1"))).toBe(false);
  });
});

describe("verifyOverlayToken", () => {
  const instance = {
    overlayTimerToken: "timer-token-1234",
    overlayTasksToken: "tasks-token-1234",
  };

  it("accepts the matching timer token", async () => {
    expect(await verifyOverlayToken(makeDb(instance), "timer", "timer-token-1234")).toBe(true);
  });

  it("accepts the matching tasks token", async () => {
    expect(await verifyOverlayToken(makeDb(instance), "tasks", "tasks-token-1234")).toBe(true);
  });

  it("rejects a mismatched token", async () => {
    expect(await verifyOverlayToken(makeDb(instance), "timer", "wrong-token-1234")).toBe(false);
  });

  it("rejects the tasks token on the timer gate (and vice versa)", async () => {
    expect(await verifyOverlayToken(makeDb(instance), "timer", "tasks-token-1234")).toBe(false);
    expect(await verifyOverlayToken(makeDb(instance), "tasks", "timer-token-1234")).toBe(false);
  });

  it("rejects when no instance config row exists", async () => {
    expect(await verifyOverlayToken(makeDb(undefined), "timer", "timer-token-1234")).toBe(false);
  });
});

describe("verifyBotToken", () => {
  it("accepts the matching bot token", async () => {
    expect(await verifyBotToken(makeDb({ botToken: "bot-token-12345" }), "bot-token-12345")).toBe(
      true,
    );
  });

  it("rejects a mismatched bot token", async () => {
    expect(await verifyBotToken(makeDb({ botToken: "bot-token-12345" }), "other-token-123")).toBe(
      false,
    );
  });

  it("rejects when no instance config row exists", async () => {
    expect(await verifyBotToken(makeDb(undefined), "bot-token-12345")).toBe(false);
  });
});
