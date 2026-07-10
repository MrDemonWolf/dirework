import { describe, it, expect } from "vitest";

// The REAL router input schema (env-free module) — no hand-copied mirror.
import { regenerateOverlayTokenInput } from "../input-schemas";

describe("user router input validation", () => {
  describe("regenerateOverlayToken", () => {
    it("accepts timer type", () => {
      const result = regenerateOverlayTokenInput.safeParse({ type: "timer" });
      expect(result.success).toBe(true);
    });

    it("accepts tasks type", () => {
      const result = regenerateOverlayTokenInput.safeParse({ type: "tasks" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = regenerateOverlayTokenInput.safeParse({ type: "invalid" });
      expect(result.success).toBe(false);
    });

    it("rejects missing type", () => {
      const result = regenerateOverlayTokenInput.safeParse({});
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
