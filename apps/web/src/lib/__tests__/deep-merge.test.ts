import { describe, expect, it } from "vitest";

import { deepMerge } from "../deep-merge";

describe("deepMerge", () => {
  it("should return defaults when overrides is empty", () => {
    const defaults = { a: 1, b: { c: 2, d: 3 } };
    const result = deepMerge(defaults, {});
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 } });
  });

  it("should override top-level values", () => {
    const defaults = { a: 1, b: 2 };
    const result = deepMerge(defaults, { a: 10 });
    expect(result).toEqual({ a: 10, b: 2 });
  });

  it("should deep merge nested objects", () => {
    const defaults = { a: { x: 1, y: 2 }, b: 3 };
    const result = deepMerge(defaults, { a: { x: 10 } });
    expect(result).toEqual({ a: { x: 10, y: 2 }, b: 3 });
  });

  it("should not merge arrays (override instead)", () => {
    const defaults = { arr: [1, 2, 3] };
    const result = deepMerge(defaults, { arr: [4, 5] });
    expect(result).toEqual({ arr: [4, 5] });
  });

  it("should handle null overrides by replacing value", () => {
    const defaults = { a: { b: 1 } };
    const result = deepMerge(defaults, { a: null });
    expect(result).toEqual({ a: null });
  });

  it("should preserve keys not present in overrides", () => {
    const defaults = {
      timer: { work: 25, break: 5, longBreak: 15 },
      styles: { color: "red" },
    };
    const result = deepMerge(defaults, { timer: { work: 30 } });
    expect(result).toEqual({
      timer: { work: 30, break: 5, longBreak: 15 },
      styles: { color: "red" },
    });
  });

  it("should handle deeply nested merges", () => {
    const defaults = {
      a: { b: { c: { d: 1, e: 2 }, f: 3 }, g: 4 },
    };
    const result = deepMerge(defaults, {
      a: { b: { c: { d: 10 } } },
    });
    expect(result).toEqual({
      a: { b: { c: { d: 10, e: 2 }, f: 3 }, g: 4 },
    });
  });
});
