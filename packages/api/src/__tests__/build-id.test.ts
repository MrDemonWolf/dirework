import { describe, expect, it } from "vitest";

import { BUILD_ID_HEADER, isBuildId } from "../build-id";

describe("build id", () => {
  it("names the header the web reads", () => {
    expect(BUILD_ID_HEADER).toBe("x-dirework-build");
  });

  it("accepts a short or full git sha and nothing else", () => {
    expect(isBuildId("413ff22")).toBe(true);
    expect(isBuildId("413ff22a1d9e8b7c6f5e4d3c2b1a09f8e7d6c5b4")).toBe(true);
    for (const value of ["dev", "", "413ff2", "413FF22", "413ff22\nx", undefined, null]) {
      expect(isBuildId(value)).toBe(false);
    }
  });
});
