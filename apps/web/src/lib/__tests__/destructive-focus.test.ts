import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buttonVariants, destructiveIconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const read = (rel: string) => readFileSync(path.join(__dirname, "../../components", rel), "utf8");

/** What `Button` renders for these props (it runs the same `cn(buttonVariants(...))`). */
const rendered = (variant: "ghost" | "outline") =>
  cn(buttonVariants({ variant, size: "icon", className: destructiveIconButton })).split(" ");

// Red icon actions keep keyboard focus red, like the destructive menu rows: the blue
// `focus-visible:border-ring` / `ring-ring/50` of the base recipe must be REPLACED (tailwind-
// merge), not stacked under the red ones, or a blue ring would still win by source order.
describe("destructive icon buttons", () => {
  it.each(["ghost", "outline"] as const)("%s: focus ring is red, never the blue ring", (v) => {
    const classes = rendered(v);
    expect(classes).toContain("focus-visible:border-destructive");
    expect(classes).toContain("focus-visible:ring-destructive/40");
    expect(classes).not.toContain("focus-visible:border-ring");
    expect(classes).not.toContain("focus-visible:ring-ring/50");
  });

  it.each([
    "timer-controls.tsx",
    "secret-url-row.tsx",
    "bot-settings/command-alias-editor.tsx",
    "task-manager.tsx",
  ])("%s uses the shared recipe instead of a hand-rolled red", (file) => {
    const source = read(file);
    expect(source).toContain("destructiveIconButton");
    expect(source).not.toContain("text-destructive hover:bg-destructive/10");
  });
});
