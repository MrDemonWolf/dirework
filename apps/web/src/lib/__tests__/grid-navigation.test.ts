import { describe, expect, it } from "vitest";

import { nextGridIndex } from "@/lib/grid-navigation";

describe("nextGridIndex", () => {
  it("steps left and right, wrapping at the ends", () => {
    expect(nextGridIndex("ArrowRight", 0, 6, 3)).toBe(1);
    expect(nextGridIndex("ArrowRight", 5, 6, 3)).toBe(0);
    expect(nextGridIndex("ArrowLeft", 0, 6, 3)).toBe(5);
  });

  it("moves a row up and down and stays put at the edges", () => {
    expect(nextGridIndex("ArrowDown", 1, 6, 2)).toBe(3);
    expect(nextGridIndex("ArrowUp", 3, 6, 2)).toBe(1);
    expect(nextGridIndex("ArrowUp", 1, 6, 2)).toBe(1);
    expect(nextGridIndex("ArrowDown", 4, 6, 2)).toBe(4);
    // One row (six columns): up and down do nothing.
    expect(nextGridIndex("ArrowDown", 2, 6, 6)).toBe(2);
    expect(nextGridIndex("ArrowUp", 2, 6, 6)).toBe(2);
  });

  it("clamps into a short last row", () => {
    // 5 items in 3 columns: index 2 has nothing below it, so it lands on the last item.
    expect(nextGridIndex("ArrowDown", 2, 5, 3)).toBe(4);
  });

  it("jumps to the ends and ignores other keys", () => {
    expect(nextGridIndex("Home", 4, 6, 3)).toBe(0);
    expect(nextGridIndex("End", 0, 6, 3)).toBe(5);
    expect(nextGridIndex("Enter", 0, 6, 3)).toBeNull();
    expect(nextGridIndex("ArrowRight", 0, 0, 3)).toBeNull();
  });
});
