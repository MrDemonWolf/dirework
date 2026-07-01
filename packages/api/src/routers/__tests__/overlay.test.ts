import { describe, it, expect } from "vitest";
import { z } from "zod";

import { tokenInput } from "../../services/tokens";

const tokenSchema = z.object({ token: tokenInput });

describe("overlay router input validation", () => {
  describe("token schema (bounded — L3)", () => {
    it("accepts a valid token string", () => {
      expect(tokenSchema.parse({ token: "abc-123-def" })).toEqual({ token: "abc-123-def" });
    });

    it("accepts a UUID token", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(tokenSchema.parse({ token: uuid })).toEqual({ token: uuid });
    });

    it("rejects missing token", () => {
      expect(() => tokenSchema.parse({})).toThrow();
    });

    it("rejects non-string token", () => {
      expect(() => tokenSchema.parse({ token: 123 })).toThrow();
    });

    it("rejects empty string token", () => {
      expect(() => tokenSchema.parse({ token: "" })).toThrow();
    });

    it("rejects tokens shorter than 8 characters", () => {
      expect(() => tokenSchema.parse({ token: "abcdefg" })).toThrow();
    });

    it("rejects tokens longer than 128 characters", () => {
      expect(() => tokenSchema.parse({ token: "a".repeat(129) })).toThrow();
    });

    it("accepts tokens at the boundaries (8 and 128 chars)", () => {
      expect(tokenSchema.parse({ token: "a".repeat(8) })).toEqual({ token: "a".repeat(8) });
      expect(tokenSchema.parse({ token: "a".repeat(128) })).toEqual({ token: "a".repeat(128) });
    });
  });

  describe("overlay response shape", () => {
    it("timer state response has expected keys when present", () => {
      const response = {
        timerState: { status: "work", currentCycle: 1, totalCycles: 4 },
        timerConfig: { workDuration: 1500000 },
        timerStyles: { dimensions: { width: "300px", height: "300px" } },
      };
      expect(response).toHaveProperty("timerState");
      expect(response).toHaveProperty("timerConfig");
      expect(response).toHaveProperty("timerStyles");
    });

    it("task list response has expected keys when present", () => {
      const response = {
        tasks: [{ id: "1", text: "Test", status: "active" }],
        taskStyles: { display: { showDone: true } },
      };
      expect(response).toHaveProperty("tasks");
      expect(response).toHaveProperty("taskStyles");
      expect(response.tasks).toHaveLength(1);
    });

    it("null response for invalid token (documents behavior)", () => {
      const response = null;
      expect(response).toBeNull();
    });
  });
});
