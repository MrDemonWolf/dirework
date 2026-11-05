import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const home = path.resolve(__dirname, "../../../../fumadocs/src/app/(home)");
const read = (file: string) => readFileSync(path.join(home, file), "utf8");

it("shares the overlay status rule and draws no focus accent edge in docs mocks", () => {
  const widget = read("_widgets/TaskListWidget.tsx");
  expect(widget).toMatch(/import\s*\{[^}]*taskStatusLabel[^}]*\}\s*from "@dirework\/overlay-kit"/);
  expect(widget).toContain("taskStatusLabel(t.status)");
  expect(widget).toContain("theme.username");
  expect(widget).not.toContain("authorPalette");
  expect(widget).not.toContain("inset 3px");
  expect(read("page.tsx")).toContain("taskStatusLabel(status)");
  expect(read("marketing.css")).not.toContain("inset 3px");
});
