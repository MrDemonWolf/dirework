import { describe, it, expect } from "vitest";

// The REAL router input schemas (env-free module) — no hand-copied mirrors.
import { taskCreateInput, taskIdInput } from "../input-schemas";

describe("task router input schemas", () => {
  describe("create", () => {
    const validInput = { text: "Write unit tests" };

    it("accepts valid input", () => {
      const result = taskCreateInput.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects client-supplied author identity", () => {
      const result = taskCreateInput.safeParse({
        ...validInput,
        authorTwitchId: "attacker-controlled",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty text", () => {
      const result = taskCreateInput.safeParse({ text: "" });
      expect(result.success).toBe(false);
    });

    it("rejects text over 500 characters", () => {
      const result = taskCreateInput.safeParse({ text: "a".repeat(501) });
      expect(result.success).toBe(false);
    });

    it("accepts text at exactly 500 characters", () => {
      const result = taskCreateInput.safeParse({ text: "a".repeat(500) });
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

  // The old "priority logic convention" block lived here: it declared its own
  // BROADCASTER_PRIORITY/VIEWER_PRIORITY constants and asserted 0 === 0 and
  // 0 < 1, which held no matter what the service did. The real derivation is
  // covered against resolveTaskPlacement in
  // services/__tests__/task-service.test.ts.
});
