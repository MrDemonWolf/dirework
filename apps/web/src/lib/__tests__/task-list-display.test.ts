// Pins the task overlay's readability rules in TaskListDisplay (the renderer has no DOM
// test environment; the layout math itself is tested in overlay-view.test.ts).

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACTIVE_LABEL_MIN_PX } from "../overlay-view";

const source = readFileSync(
  path.resolve(import.meta.dirname, "../../components/task-list-display.tsx"),
  "utf8",
);

describe("task overlay text", () => {
  it("wraps long text anywhere instead of cutting it mid-letter", () => {
    expect(source).toContain('overflowWrap: "anywhere"');
  });

  it("clamps lines per task to 1–6 at render, ending in an ellipsis", () => {
    expect(source).toContain("WebkitLineClamp: clampTaskLines(config.display.numberOfLines)");
    expect(source).toContain('display: "-webkit-box"');
  });

  it("lays task text and author names out by their own direction", () => {
    expect(source.match(/dir="auto"/g)).toHaveLength(2);
  });

  it("trims Zalgo stacks at render for rows stored before ingest trimmed them", () => {
    expect(source).toContain("{limitCombiningMarks(task.text)}");
    expect(source).toContain("{limitCombiningMarks(group.authorDisplayName)}");
  });

  it("never draws the Active label under 14px at the source size", () => {
    expect(ACTIVE_LABEL_MIN_PX).toBeGreaterThanOrEqual(14);
    expect(source).toMatch(/fontSize: `max\(\$\{ACTIVE_LABEL_MIN_PX\}px, calc\(/);
  });

  it("hides whole rows and groups through fitStaticList, without moving layout", () => {
    expect(source).toContain("fitStaticList(");
    expect(source).toContain("groupEl.style.visibility");
    expect(source).toContain("groupEl.style.clipPath");
    expect(source).not.toMatch(/style\.(display|height|maxHeight)\s*=/);
  });
});
