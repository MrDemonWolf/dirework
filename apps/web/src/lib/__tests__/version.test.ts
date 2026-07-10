import { describe, expect, it } from "vitest";

import { isStale } from "../version";

describe("isStale", () => {
  it("is false when SHAs match", () => {
    expect(isStale("abc1234", "abc1234")).toBe(false);
  });

  it("is true when a newer deploy is live", () => {
    expect(isStale("abc1234", "def5678")).toBe(true);
  });

  it("ignores dev/empty SHAs so local dev never nags", () => {
    expect(isStale("dev", "abc1234")).toBe(false);
    expect(isStale("abc1234", "dev")).toBe(false);
    expect(isStale(undefined, "abc1234")).toBe(false);
    expect(isStale("abc1234", undefined)).toBe(false);
  });
});
