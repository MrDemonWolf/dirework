import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

/** Every .ts/.tsx source file under src, tests excluded. */
function sources(dir = src): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sources(full);
    return /\.tsx?$/.test(name) ? [path.relative(src, full)] : [];
  });
}

describe("page header", () => {
  it("renders the page title recipe in one place", () => {
    const owners = sources().filter((file) =>
      read(file).includes("font-heading text-3xl font-bold tracking-tight"),
    );
    expect(owners).toEqual(["components/page-header.tsx"]);
  });

  it.each([
    "app/(app)/dashboard/dashboard.tsx",
    "app/(app)/dashboard/styles/styles-page.tsx",
    "app/(app)/dashboard/bot/layout.tsx",
  ])("%s renders <PageHeader", (file) => {
    expect(read(file)).toContain("<PageHeader");
  });

  it.each(["components/dashboard-skeleton.tsx", "components/styles-skeleton.tsx"])(
    "%s draws the band with <PageHeaderSkeleton",
    (file) => {
      expect(read(file)).toContain("<PageHeaderSkeleton");
    },
  );

  it("draws each skeleton bar inside its real line box", () => {
    const header = read("components/page-header.tsx");
    // 12px mono × 1.5 kicker, text-3xl (36px) title, mt-1 + text-sm (20px) description lines.
    expect(header).toContain('"mb-2 flex h-4.5 items-center"');
    expect(header).toContain('lineClassName="h-9"');
    expect(header).toMatch(/<div className="mt-1">\s*<LineBoxes[^>]*lineClassName="h-5"/);
  });

  it("draws every kicker one way, and never repeats the page's own title", () => {
    const header = read("components/page-header.tsx");
    expect(header).toMatch(/<p className="console-label mb-2"[^>]*>\s*\{kicker\}/);
    const pages = [
      "app/(app)/dashboard/dashboard.tsx",
      "app/(app)/dashboard/styles/styles-page.tsx",
      "app/(app)/dashboard/bot/layout.tsx",
    ];
    for (const page of pages) {
      // Copy only: the component owns the kicker's look.
      expect(read(page), page).not.toMatch(/kicker=\{</);
    }
    // Theme Center's rule above its h1 said "Theme Center" twice.
    expect(read("app/(app)/dashboard/styles/styles-page.tsx")).not.toContain(
      '<ConsoleRule label="Theme Center"',
    );
    expect(read("components/styles-skeleton.tsx")).not.toMatch(
      /<PageHeaderSkeleton[^/]*\bkicker\b/,
    );
  });
});
