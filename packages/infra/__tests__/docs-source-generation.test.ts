import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `createMDX()` in apps/fumadocs/next.config.mjs fires an UN-awaited regeneration of
// `.source/*` (fs.writeFile = open(O_TRUNC) then write) every time the config loads,
// unless `_FUMADOCS_MDX=1`. `next typegen` loads the config and then calls
// `process.exit(0)`; when it exits between the truncate and the write, `.source/server.ts`
// is left at 0 bytes and the following `tsc` fails with TS2306 "is not a module" (seen in
// CI). The scripts therefore generate `.source` with the awaited `fumadocs-mdx` CLI first
// and run Next with the guard set, so no second, unawaited writer exists.

const fumadocsDir = resolve(import.meta.dirname, "../../../apps/fumadocs");
const GUARD = "_FUMADOCS_MDX=1";

function scripts(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(`${fumadocsDir}/package.json`, "utf8")) as {
    scripts: Record<string, string>;
  };
  return pkg.scripts;
}

describe("fumadocs .source generation", () => {
  it.each([
    ["check-types", "next typegen"],
    ["build", "next build"],
  ])("%s generates .source first and runs `%s` with the init guard", (name, nextCommand) => {
    const script = scripts()[name] ?? "";
    const generate = script.indexOf("fumadocs-mdx &&");
    const next = script.indexOf(`${GUARD} ${nextCommand}`);

    expect(generate).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(generate);
    // Any unguarded Next invocation would start the background writer again.
    expect(script.split(nextCommand).length - 1).toBe(1);
  });

  it("installed fumadocs-mdx still skips its background init when the guard is set", () => {
    const requireFromDocs = createRequire(`${fumadocsDir}/package.json`);
    const entry = requireFromDocs.resolve("fumadocs-mdx/next");
    const source = readFileSync(entry.replace(/\.cjs$/, ".js"), "utf8");

    // If an upgrade renames this guard, the scripts above silently stop protecting tsc.
    expect(source).toMatch(/if \(process\.env\._FUMADOCS_MDX !== "1"\) \{[^}]*init\(/);
  });
});
