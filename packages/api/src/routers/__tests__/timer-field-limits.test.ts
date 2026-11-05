import { describe, expect, it } from "vitest";

import { TIMER_FIELD_LIMITS } from "../../config-defaults";
import { updateTimerConfigInput } from "../input-schemas";

const MINUTE_MS = 60_000;

// The dashboard's timer fields clamp to TIMER_FIELD_LIMITS (tighter than the save schema,
// which stays the authority). Every bound the editor can send must still save.
describe("TIMER_FIELD_LIMITS", () => {
  for (const [field, limit] of Object.entries(TIMER_FIELD_LIMITS)) {
    it(`${field}: the save schema accepts the editor's min and max`, () => {
      const toInput = (v: number) => (limit.unit === "min" ? v * MINUTE_MS : v);
      expect(limit.min).toBeLessThanOrEqual(limit.max);
      for (const bound of [limit.min, limit.max]) {
        const result = updateTimerConfigInput.safeParse({ [field]: toInput(bound) });
        expect(result.success, `${field} = ${bound}`).toBe(true);
      }
    });
  }

  it("covers every editable duration and count field", () => {
    expect(Object.keys(TIMER_FIELD_LIMITS).sort()).toEqual(
      [
        "breakDuration",
        "defaultCycles",
        "longBreakDuration",
        "longBreakInterval",
        "workDuration",
      ].sort(),
    );
  });
});
