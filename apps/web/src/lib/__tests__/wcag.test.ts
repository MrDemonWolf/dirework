import { describe, expect, it } from "vitest";

import { composite, contrastRatio, parseHex, relativeLuminance } from "./helpers/wcag";

// Every contrast gate (obs-contrast, tokens-contrast, theme-contrast) computes with these
// helpers, so they must agree with published reference ratios, or every assertion is moot.
describe("WCAG contrast helpers", () => {
  it("match the WCAG reference values", () => {
    expect(contrastRatio(parseHex("#000000"), parseHex("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex("#777777"), parseHex("#ffffff"))).toBeCloseTo(4.48, 2);
    expect(contrastRatio(parseHex("#767676"), parseHex("#ffffff"))).toBeCloseTo(4.54, 2);
    expect(contrastRatio(parseHex("#595959"), parseHex("#ffffff"))).toBeCloseTo(7.0, 1);
  });

  it("is symmetric in its arguments", () => {
    expect(contrastRatio(parseHex("#ffffff"), parseHex("#595959"))).toBeCloseTo(
      contrastRatio(parseHex("#595959"), parseHex("#ffffff")),
      10,
    );
  });

  it("parses #rrggbb in either case into 0–1 channels and refuses anything else", () => {
    expect(parseHex("#FF8000")).toEqual([1, 128 / 255, 0]);
    expect(() => parseHex("#fff")).toThrow();
    expect(() => parseHex("red")).toThrow();
  });

  it("linearises at the WCAG 2.2 threshold, 0.04045", () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1, 10);
    // At the threshold the linear segment applies.
    expect(relativeLuminance([0.04045, 0.04045, 0.04045])).toBeCloseTo(0.04045 / 12.92, 10);
  });

  it("composites a translucent layer over an opaque one, source-over", () => {
    expect(composite([1, 1, 1], 0, [0, 0, 0])).toEqual([0, 0, 0]);
    expect(composite([1, 1, 1], 1, [0, 0, 0])).toEqual([1, 1, 1]);
    expect(composite([1, 0, 0], 0.25, [0, 0, 1])).toEqual([0.25, 0, 0.75]);
  });
});
