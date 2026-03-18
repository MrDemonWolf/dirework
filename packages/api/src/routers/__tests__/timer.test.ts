import { describe, it, expect } from "vitest";
import { z } from "zod";

const timerStatusEnum = z.enum([
  "idle",
  "starting",
  "work",
  "break",
  "longBreak",
  "paused",
  "finished",
]);

const transitionSchema = z.object({
  status: timerStatusEnum,
  durationMs: z.number().optional(),
});

describe("timer.transition input validation", () => {
  describe("valid status values", () => {
    const validStatuses = [
      "idle",
      "starting",
      "work",
      "break",
      "longBreak",
      "paused",
      "finished",
    ] as const;

    it.each(validStatuses)('accepts "%s" as a valid status', (status) => {
      const result = transitionSchema.safeParse({ status });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(status);
      }
    });
  });

  describe("invalid status values", () => {
    const invalidStatuses = ["invalid", "WORK", "running", "", "Work"];

    it.each(invalidStatuses)('rejects "%s" as an invalid status', (status) => {
      const result = transitionSchema.safeParse({ status });
      expect(result.success).toBe(false);
    });
  });

  describe("durationMs is optional", () => {
    it("succeeds when durationMs is omitted", () => {
      const result = transitionSchema.safeParse({ status: "work" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.durationMs).toBeUndefined();
      }
    });

    it("succeeds when durationMs is a valid number", () => {
      const result = transitionSchema.safeParse({
        status: "work",
        durationMs: 25000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.durationMs).toBe(25000);
      }
    });
  });

  describe("durationMs must be a number", () => {
    it("rejects a string for durationMs", () => {
      const result = transitionSchema.safeParse({
        status: "work",
        durationMs: "25000",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("extra fields are stripped", () => {
    it("strips unrecognized fields from the parsed output", () => {
      const result = transitionSchema.safeParse({
        status: "idle",
        durationMs: 5000,
        extraField: "should be removed",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ status: "idle", durationMs: 5000 });
        expect("extraField" in result.data).toBe(false);
      }
    });
  });
});
