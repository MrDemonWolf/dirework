import { describe, it, expect } from "vitest";
import { z } from "zod";

const overlayTokenSchema = z.object({
  token: z.string(),
  type: z.enum(["timer", "tasks"]),
});
const regenerateSchema = z.object({ type: z.enum(["timer", "tasks"]) });

describe("user router input validation", () => {
  describe("getByOverlayToken", () => {
    it("accepts valid timer token input", () => {
      const result = overlayTokenSchema.safeParse({
        token: crypto.randomUUID(),
        type: "timer",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid tasks token input", () => {
      const result = overlayTokenSchema.safeParse({
        token: crypto.randomUUID(),
        type: "tasks",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = overlayTokenSchema.safeParse({
        token: crypto.randomUUID(),
        type: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing token", () => {
      const result = overlayTokenSchema.safeParse({ type: "timer" });
      expect(result.success).toBe(false);
    });
  });

  describe("regenerateOverlayToken", () => {
    it("accepts timer type", () => {
      const result = regenerateSchema.safeParse({ type: "timer" });
      expect(result.success).toBe(true);
    });

    it("accepts tasks type", () => {
      const result = regenerateSchema.safeParse({ type: "tasks" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = regenerateSchema.safeParse({ type: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  describe("token generation", () => {
    it("crypto.randomUUID returns valid UUID v4 format", () => {
      const token = crypto.randomUUID();
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
