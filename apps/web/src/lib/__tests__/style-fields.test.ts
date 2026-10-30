import { describe, expect, it } from "vitest";

import { cssLengthSchema, taskStylesInputSchema } from "@dirework/api/config-shared";
import { TASK_LENGTH_LIMITS, TIMER_LENGTH_LIMITS } from "@dirework/api/style-limits";

import { lengthFieldError, stepLength, withDefaultUnit } from "../style-fields";

describe("stepLength", () => {
  it("nudges a single length and keeps its unit", () => {
    expect(stepLength("20px", 1)).toBe("21px");
    expect(stepLength("20px", -10)).toBe("10px");
    expect(stepLength("50%", 1, "px")).toBe("51%");
    expect(stepLength(" 1.5rem ", 1)).toBe("2.5rem");
    expect(stepLength("0.1em", 0.2)).toBe("0.3em");
  });

  it("gives a bare number the field's unit, and stops at zero", () => {
    expect(stepLength("12", 1, "px")).toBe("13px");
    expect(stepLength("3px", -10)).toBe("0px");
    expect(stepLength("1", -1, "px")).toBe("0");
  });

  it("always yields a length the server accepts", () => {
    for (const next of [stepLength("20px", 1), stepLength("12", 1, "px"), stepLength("1", -5)]) {
      expect(cssLengthSchema.safeParse(next).success, String(next)).toBe(true);
    }
  });

  it("stays inside the field's limit, in the value's own unit", () => {
    const label = TIMER_LENGTH_LIMITS["fontSizes.label"]; // 14–48px, 2–40vw/vh
    expect(stepLength("48px", 1, "px", label)).toBe("48px");
    expect(stepLength("14px", -10, "px", label)).toBe("14px");
    expect(stepLength("90px", -1, "px", label)).toBe("48px");
    expect(stepLength("3rem", 1, "px", label)).toBe("3rem");
    expect(stepLength("40vw", 1, "px", label)).toBe("40vw");
    expect(stepLength("20", 1, "px", label)).toBe("21px");
    // A unit the field doesn't take: no nudge, the inline error explains.
    expect(stepLength("50%", 1, "px", label)).toBeNull();
  });

  it("leaves multi-value, empty and non-numeric values to the key's default", () => {
    expect(stepLength("10px 14px", 1)).toBeNull();
    expect(stepLength("", 1)).toBeNull();
    expect(stepLength("auto", 1)).toBeNull();
    expect(stepLength("-4px", 1)).toBeNull();
  });
});

describe("lengthFieldError", () => {
  const margin = TASK_LENGTH_LIMITS["task.marginBottom"];
  it("agrees with the save schema for each field", () => {
    for (const value of ["8px", "-4px", "49px", "auto", "4px 4px", "0", "3rem", "x;y"]) {
      const saves = taskStylesInputSchema.safeParse({ task: { marginBottom: value } }).success;
      expect(lengthFieldError(value, margin) === null, value).toBe(saves);
    }
  });

  it("names the range", () => {
    expect(lengthFieldError("-4px", margin)).toBe("Out of range. Use 0–48px");
    expect(lengthFieldError("abc", margin)).toBe("Use a length in 0–48px");
  });
});

describe("withDefaultUnit", () => {
  it("turns a bare number into a length the server accepts", () => {
    expect(withDefaultUnit("320", "px")).toBe("320px");
    expect(withDefaultUnit(" 1.5 ", "px")).toBe("1.5px");
    expect(cssLengthSchema.safeParse(withDefaultUnit("320", "px")).success).toBe(true);
    expect(cssLengthSchema.safeParse("320").success).toBe(false);
  });

  it("leaves zero, existing units, other text and unit-less fields alone", () => {
    expect(withDefaultUnit("0", "px")).toBe("0");
    expect(withDefaultUnit("50%", "px")).toBe("50%");
    expect(withDefaultUnit("10px 14px", "px")).toBe("10px 14px");
    expect(withDefaultUnit("abc", "px")).toBe("abc");
    expect(withDefaultUnit("12", undefined)).toBe("12");
  });
});
