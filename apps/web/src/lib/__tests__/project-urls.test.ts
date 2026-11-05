// The project's own URLs and owner name live in one place, `BRAND.links` / `BRAND.owner` in
// @dirework/overlay-kit, which both apps and the infra program import. A repo move, a docs
// domain change or a company rename is then one edit, not a hunt across two apps.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND } from "@dirework/overlay-kit";

import { landingLinks } from "../landing-links";

const repoRoot = path.resolve(__dirname, "../../../../..");
const ROOTS = ["apps/web/src", "apps/fumadocs/src", "packages/infra"];
const SKIP = new Set(["node_modules", ".alchemy", "dist", ".next", ".source", "__tests__"]);

/** Every .ts/.tsx/.mjs source under `dir`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|mjs)$/.test(name) ? [full] : [];
  });
}

describe("project URLs and owner", () => {
  it("are typed out only in BRAND", () => {
    const literals = [
      "github.com/mrdemonwolf/dirework",
      "dirework.mrdemonwolf.dev",
      "mrdwolf.net/discord",
      "www.mrdemonwolf.com",
      "MrDemonWolf, Inc.",
    ];
    const copies = ROOTS.flatMap((root) => sourceFiles(path.join(repoRoot, root))).flatMap(
      (file) => {
        const text = readFileSync(file, "utf8").toLowerCase();
        return literals
          .filter((literal) => text.includes(literal.toLowerCase()))
          .map((literal) => `${path.relative(repoRoot, file)} → ${literal}`);
      },
    );
    expect(copies, "read BRAND.links / BRAND.owner from @dirework/overlay-kit").toEqual([]);
  });

  it("the landing links build on them", () => {
    const links = landingLinks(undefined);
    expect(links.repo).toBe(BRAND.links.repo);
    expect(links.support).toBe(BRAND.links.support);
    expect(links.docs).toBe(`${BRAND.links.docs}/docs`);
  });
});
