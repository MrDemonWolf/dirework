import { describe, expect, it } from "vitest";

import { cssLengthSchema } from "@dirework/api/config-shared";

import { stepLength, withDefaultUnit } from "../style-fields";

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

  it("leaves multi-value, empty and non-numeric values to the key's default", () => {
    expect(stepLength("10px 14px", 1)).toBeNull();
    expect(stepLength("", 1)).toBeNull();
    expect(stepLength("auto", 1)).toBeNull();
    expect(stepLength("-4px", 1)).toBeNull();
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
