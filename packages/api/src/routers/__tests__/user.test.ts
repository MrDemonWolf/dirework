import { describe, it, expect } from "vitest";

// The REAL router input schema (env-free module) — no hand-copied mirror.
import { confirmSetupStepInput, regenerateOverlayTokenInput } from "../input-schemas";

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

  describe("confirmSetupStep", () => {
    it.each(["botSource", "timerOverlay", "tasksOverlay"] as const)(
      "accepts %s confirmed and un-confirmed",
      (step) => {
        expect(confirmSetupStepInput.safeParse({ step, confirmed: true }).success).toBe(true);
        expect(confirmSetupStepInput.safeParse({ step, confirmed: false }).success).toBe(true);
      },
    );

    it("rejects an unknown step", () => {
      const result = confirmSetupStepInput.safeParse({ step: "botAccount", confirmed: true });
      expect(result.success).toBe(false);
    });

    it("rejects extra keys", () => {
      const result = confirmSetupStepInput.safeParse({
        step: "botSource",
        confirmed: true,
        channelLogin: "streamer",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing or non-boolean confirmed", () => {
      expect(confirmSetupStepInput.safeParse({ step: "botSource" }).success).toBe(false);
      expect(
        confirmSetupStepInput.safeParse({ step: "botSource", confirmed: "true" }).success,
      ).toBe(false);
    });
  });
});
