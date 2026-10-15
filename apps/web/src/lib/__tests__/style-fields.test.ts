import { describe, expect, it } from "vitest";

import { cssLengthSchema } from "@dirework/api/config-shared";

import { withDefaultUnit } from "../style-fields";

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
