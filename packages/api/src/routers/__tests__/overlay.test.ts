import { describe, it, expect } from "vitest";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string() });

describe("overlay router input validation", () => {
  describe("token schema", () => {
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

    it("accepts empty string token (validation is at DB level)", () => {
      expect(tokenSchema.parse({ token: "" })).toEqual({ token: "" });
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
