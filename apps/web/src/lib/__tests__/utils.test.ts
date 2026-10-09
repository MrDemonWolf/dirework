import { describe, expect, it } from "vitest";

import { cn, isDeepEqual } from "../utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes, last one wins", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});

describe("isDeepEqual", () => {
  it("compares nested objects structurally, ignoring key order", () => {
    expect(
      isDeepEqual({ a: 1, b: { c: "x", d: [1, 2] } }, { b: { d: [1, 2], c: "x" }, a: 1 }),
    ).toBe(true);
  });

  it("detects a changed nested value", () => {
    expect(isDeepEqual({ ring: { color: "#fff" } }, { ring: { color: "#000" } })).toBe(false);
  });

  it("detects added, missing, or renamed keys", () => {
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(isDeepEqual({ a: 1, b: undefined }, { a: 1, c: undefined })).toBe(false);
  });

  it("distinguishes arrays from objects and compares array order", () => {
    expect(isDeepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(isDeepEqual([1, 2], [2, 1])).toBe(false);
  });

  it("handles primitives and null", () => {
    expect(isDeepEqual(0.5, 0.5)).toBe(true);
    expect(isDeepEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(isDeepEqual(null, {})).toBe(false);
    expect(isDeepEqual("1", 1)).toBe(false);
  });
});
