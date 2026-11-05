import { describe, expect, it } from "vitest";

import { gridColumnCount, rovingTabStop } from "@/lib/use-roving-grid";

describe("rovingTabStop", () => {
  it("follows focus while it is inside the group", () => {
    expect(rovingTabStop(4, 1)).toBe(4);
    // Index 0 is a focused item, not "nothing focused".
    expect(rovingTabStop(0, 3)).toBe(0);
  });

  it("goes back to the checked item once focus leaves the group", () => {
    expect(rovingTabStop(null, 3)).toBe(3);
  });

  it("falls back to the first item when nothing is checked", () => {
    expect(rovingTabStop(null, -1)).toBe(0);
  });
});

describe("gridColumnCount", () => {
  it("counts the tracks of a computed grid-template-columns", () => {
    // The preset gallery at xl (6 columns) and below md (2), and the icon picker (7).
    expect(gridColumnCount("187px 187px 187px 187px 187px 187px")).toBe(6);
    expect(gridColumnCount("171.5px 171.5px")).toBe(2);
    expect(gridColumnCount("38px 38px 38px 38px 38px 38px 38px")).toBe(7);
  });

  it("never goes below one column", () => {
    expect(gridColumnCount("none")).toBe(1);
    expect(gridColumnCount("")).toBe(1);
  });
});
