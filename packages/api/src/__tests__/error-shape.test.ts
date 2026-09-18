import { describe, expect, it } from "vitest";

import { redactInternalErrorShape } from "../index";

describe("tRPC client error redaction", () => {
  it("replaces internal messages and removes stack details", () => {
    const shape = {
      message: "D1_ERROR: statement included a secret value",
      data: { code: "INTERNAL_SERVER_ERROR", stack: "/srv/private/path.ts:42" },
    };

    expect(redactInternalErrorShape(shape, "INTERNAL_SERVER_ERROR")).toEqual({
      message: "Internal server error",
      data: { code: "INTERNAL_SERVER_ERROR" },
    });
  });

  it("preserves intentional authentication and validation errors", () => {
    const shape = {
      message: "Owner access required",
      data: { code: "FORBIDDEN" },
    };

    expect(redactInternalErrorShape(shape, "FORBIDDEN")).toBe(shape);
  });
});
