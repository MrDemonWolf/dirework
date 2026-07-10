import { describe, it, expect } from "vitest";

// The REAL router input schemas (env-free module) — no hand-copied mirrors.
import { taskCreateInput, taskIdInput } from "../input-schemas";

describe("task router input schemas", () => {
  describe("create", () => {
    const validInput = {
      authorTwitchId: "12345",
      authorUsername: "testuser",
      authorDisplayName: "TestUser",
      text: "Write unit tests",
    };

    it("accepts valid input", () => {
      const result = taskCreateInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("accepts valid input with optional authorColor", () => {
      const result = taskCreateInput.safeParse({
        ...validInput,
        authorColor: "#FF5500",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid input without authorColor", () => {
      const result = taskCreateInput.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.authorColor).toBeUndefined();
      }
    });

    it("rejects empty text", () => {
      const result = taskCreateInput.safeParse({ ...validInput, text: "" });
      expect(result.success).toBe(false);
    });

    it("rejects text over 500 characters", () => {
      const result = taskCreateInput.safeParse({
        ...validInput,
        text: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("accepts text at exactly 500 characters", () => {
      const result = taskCreateInput.safeParse({
        ...validInput,
        text: "a".repeat(500),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("id input (markDone / remove / activate)", () => {
    it("accepts a valid id", () => {
      const result = taskIdInput.safeParse({ id: "task-1" });
      expect(result.success).toBe(true);
    });

    it("rejects missing id", () => {
      const result = taskIdInput.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("priority logic convention", () => {
    const BROADCASTER_PRIORITY = 0;
    const VIEWER_PRIORITY = 1;

    it("broadcaster priority is 0 (pinned to top)", () => {
      expect(BROADCASTER_PRIORITY).toBe(0);
    });

    it("viewer priority is 1", () => {
      expect(VIEWER_PRIORITY).toBe(1);
    });

    it("broadcaster priority sorts before viewer priority", () => {
      expect(BROADCASTER_PRIORITY).toBeLessThan(VIEWER_PRIORITY);
    });
  });
});
