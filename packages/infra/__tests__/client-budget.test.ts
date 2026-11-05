import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CLIENT_JS_BUDGETS_KIB,
  type ClientBudgets,
  FORBIDDEN_MARKER_ROUTES,
  ROUTE_STATS_PATH,
  checkClientBudget,
  formatBudgetTable,
  measureRoutes,
  parseRouteBundleStats,
} from "../client-budget";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

/** `kib` KiB that gzip cannot shrink, so a fixture chunk's gzip size is about its raw size. */
function incompressible(kib: number, seed: string): Buffer {
  const blocks: Buffer[] = [];
  for (let i = 0; blocks.length * 32 < kib * 1024; i++) {
    blocks.push(createHash("sha256").update(`${seed}:${i}`).digest());
  }
  return Buffer.concat(blocks).subarray(0, kib * 1024);
}

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A stand-in for apps/web after `build:worker`: the stats file Next writes
 * (same shape as .next/diagnostics/route-bundle-stats.json) and the chunks it lists.
 */
function fakeWebDir(
  routes: Record<string, string[]>,
  chunks: Record<string, Buffer>,
  { writeStats = true } = {},
): string {
  const webDir = mkdtempSync(path.join(tmpdir(), "dirework-client-budget-"));
  tempDirs.push(webDir);
  mkdirSync(path.join(webDir, ".next/static/chunks"), { recursive: true });
  for (const [name, content] of Object.entries(chunks)) {
    writeFileSync(path.join(webDir, ".next/static/chunks", name), content);
  }
  if (writeStats) {
    const stats = Object.entries(routes).map(([route, names]) => ({
      route,
      firstLoadUncompressedJsBytes: names.reduce(
        (sum, name) => sum + (chunks[name]?.length ?? 0),
        0,
      ),
      firstLoadChunkPaths: names.map((name) => `.next/static/chunks/${name}`),
    }));
    mkdirSync(path.join(webDir, ".next/diagnostics"), { recursive: true });
    writeFileSync(path.join(webDir, ROUTE_STATS_PATH), JSON.stringify(stats, null, 2));
  }
  return webDir;
}

// framework.js is shared, like the root layout chunk every real route loads.
const CHUNKS = {
  "framework.js": incompressible(20, "framework"),
  "overlay.js": incompressible(5, "overlay"),
  "landing.js": incompressible(10, "landing"),
  "dashboard.js": incompressible(30, "dashboard"),
};
const ROUTES = {
  "/overlay/t/[token]": ["framework.js", "overlay.js"], // ≈ 25 KiB gz
  "/": ["framework.js", "landing.js"], // ≈ 30 KiB gz
  "/dashboard": ["framework.js", "dashboard.js"], // ≈ 50 KiB gz
};
const BUDGETS: ClientBudgets = {
  "token pages": { "/overlay/t/[token]": 30 },
  "public pages": { "/": 40 },
  dashboard: { "/dashboard": 60 },
};

function withMarker(marker: string, chunk: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`var e=Symbol.for("${marker}");`), chunk]);
}

describe("checkClientBudget", () => {
  it("passes when every route's first-load JS is within its budget", () => {
    const { errors, rows } = checkClientBudget({
      webDir: fakeWebDir(ROUTES, CHUNKS),
      budgets: BUDGETS,
    });

    expect(errors).toEqual([]);
    expect(rows.map(({ route, group, budgetKib }) => ({ route, group, budgetKib }))).toEqual([
      { route: "/overlay/t/[token]", group: "token pages", budgetKib: 30 },
      { route: "/", group: "public pages", budgetKib: 40 },
      { route: "/dashboard", group: "dashboard", budgetKib: 60 },
    ]);
    const overlay = rows.find((row) => row.route === "/overlay/t/[token]");
    expect(overlay?.kib).toBeGreaterThan(25);
    expect(overlay?.kib).toBeLessThan(26);
  });

  it("fails a route whose first-load JS is over its budget, naming size and budget", () => {
    const { errors } = checkClientBudget({
      webDir: fakeWebDir(ROUTES, CHUNKS),
      budgets: { ...BUDGETS, dashboard: { "/dashboard": 45 } },
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(
      /^\/dashboard: 50\.\d\d KiB gzip, over its 45 KiB budget by 5\.\d\d KiB/,
    );
  });

  it("fails when the build left no route stats file, instead of passing a build it never measured", () => {
    const webDir = fakeWebDir(ROUTES, CHUNKS, { writeStats: false });

    expect(() => checkClientBudget({ webDir, budgets: BUDGETS })).toThrow(
      /route-bundle-stats\.json[\s\S]*build:worker/,
    );
  });

  it("fails when a listed chunk is missing rather than counting it as zero", () => {
    const withoutLanding = Object.fromEntries(
      Object.entries(CHUNKS).filter(([name]) => name !== "landing.js"),
    );
    const webDir = fakeWebDir(ROUTES, withoutLanding);

    expect(() => checkClientBudget({ webDir, budgets: BUDGETS })).toThrow(
      /\.next\/static\/chunks\/landing\.js/,
    );
  });

  it.each([
    ["ZodError", "/overlay/t/[token]", "overlay.js"],
    ["drizzle:Name", "/", "landing.js"],
  ] as const)(
    "fails on %s in the chunks of %s once markers are enforced",
    (marker, route, chunk) => {
      const webDir = fakeWebDir(ROUTES, {
        ...CHUNKS,
        [chunk]: withMarker(marker, CHUNKS[chunk]),
      });

      const enforced = checkClientBudget({ webDir, budgets: BUDGETS, enforceMarkers: true });
      expect(enforced.errors).toEqual([
        expect.stringContaining(`${route} ships ${marker} (.next/static/chunks/${chunk})`),
      ]);

      // Off (today's setting until zod leaves the browser bundles): reported, not failed.
      const reported = checkClientBudget({ webDir, budgets: BUDGETS, enforceMarkers: false });
      expect(reported.errors).toEqual([]);
      expect(reported.notes).toEqual([expect.stringContaining(`${route} ships ${marker}`)]);
    },
  );

  it("does not scan the dashboard, where zod loads by design (Theme Center, Replies)", () => {
    const webDir = fakeWebDir(ROUTES, {
      ...CHUNKS,
      "dashboard.js": withMarker("ZodError", CHUNKS["dashboard.js"]),
    });

    const { errors, notes } = checkClientBudget({ webDir, budgets: BUDGETS, enforceMarkers: true });
    expect(errors).toEqual([]);
    expect(notes).toEqual([]);
  });

  it("fails a route without a budget and a budget without a route, so the table can't drift", () => {
    const { errors } = checkClientBudget({
      webDir: fakeWebDir({ ...ROUTES, "/new-page": ["framework.js"] }, CHUNKS),
      budgets: { ...BUDGETS, dashboard: { "/dashboard": 60, "/dashboard/gone": 60 } },
    });

    expect(errors).toHaveLength(2);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\/new-page: no budget\b/),
        expect.stringMatching(/^\/dashboard\/gone: has a budget but the build has no such route\b/),
      ]),
    );
  });
});

describe("measureRoutes", () => {
  it("reads and gzips a chunk shared by several routes only once", () => {
    const reads: string[] = [];
    measureRoutes(
      [
        { route: "/a", firstLoadChunkPaths: ["shared.js", "a.js"] },
        { route: "/b", firstLoadChunkPaths: ["shared.js", "b.js"] },
      ],
      (chunkPath) => {
        reads.push(chunkPath);
        return incompressible(4, chunkPath);
      },
    );

    expect(reads.sort()).toEqual(["a.js", "b.js", "shared.js"]);
  });

  it("sums the gzip size of every first-load chunk of a route", () => {
    const read = (chunkPath: string) => incompressible(8, chunkPath);
    const [both, shared, own] = measureRoutes(
      [
        { route: "/a", firstLoadChunkPaths: ["shared.js", "a.js"] },
        { route: "/shared", firstLoadChunkPaths: ["shared.js"] },
        { route: "/own", firstLoadChunkPaths: ["a.js"] },
      ],
      read,
    );

    expect(both?.gzipBytes).toBe((shared?.gzipBytes ?? 0) + (own?.gzipBytes ?? 0));
  });
});

describe("parseRouteBundleStats", () => {
  it("reads the route and first-load chunk list of each row Next writes", () => {
    const stats = parseRouteBundleStats(
      JSON.stringify([
        {
          route: "/overlay/t/[token]",
          firstLoadUncompressedJsBytes: 835360,
          firstLoadChunkPaths: [".next/static/chunks/a.js", ".next/static/chunks/turbopack-b.js"],
        },
      ]),
    );

    expect(stats).toEqual([
      {
        route: "/overlay/t/[token]",
        firstLoadChunkPaths: [".next/static/chunks/a.js", ".next/static/chunks/turbopack-b.js"],
      },
    ]);
  });

  it.each([
    ["text that isn't JSON", "<html>"],
    ["an object", "{}"],
    ["an empty list", "[]"],
    ["a row without chunks", '[{"route":"/","firstLoadChunkPaths":[]}]'],
    ["a row without a route", '[{"firstLoadChunkPaths":["a.js"]}]'],
  ])("refuses %s: Next changed the undocumented file, so nothing was measured", (_, text) => {
    expect(() => parseRouteBundleStats(text)).toThrow(/route-bundle-stats\.json/);
  });
});

describe("formatBudgetTable", () => {
  it("prints each route's size, budget and headroom as a Markdown table", () => {
    const table = formatBudgetTable([
      { route: "/overlay/t/[token]", group: "token pages", kib: 243.55, budgetKib: 251 },
      { route: "/new-page", group: null, kib: 12.5, budgetKib: null },
    ]);

    expect(table.split("\n")).toEqual([
      "| Route | Group | KiB gzip | Budget | Headroom |",
      "| --- | --- | ---: | ---: | ---: |",
      "| `/overlay/t/[token]` | token pages | 243.55 | 251 | 7.45 |",
      "| `/new-page` | none | 12.50 | none | none |",
    ]);
  });
});

describe("CLIENT_JS_BUDGETS_KIB", () => {
  const budgeted = Object.values(CLIENT_JS_BUDGETS_KIB).flatMap((group) => Object.keys(group));

  it("gives each route one budget, in whole KiB", () => {
    expect(new Set(budgeted).size).toBe(budgeted.length);
    for (const kib of Object.values(CLIENT_JS_BUDGETS_KIB).flatMap((g) => Object.values(g))) {
      expect(Number.isInteger(kib) && kib > 0).toBe(true);
    }
  });

  it("scans only budgeted routes for forbidden markers: every token page and the landing", () => {
    expect(budgeted).toEqual(expect.arrayContaining([...FORBIDDEN_MARKER_ROUTES]));
    expect(FORBIDDEN_MARKER_ROUTES).toEqual(
      expect.arrayContaining(["/overlay/t/[token]", "/overlay/l/[token]", "/bot/[token]", "/"]),
    );
  });
});

describe("verify.yml", () => {
  it("checks the client JS budget after the Worker bundle budget, under the same build gate", () => {
    const verify = readFileSync(path.join(repoRoot, ".github/workflows/verify.yml"), "utf8");
    const step = verify.indexOf("- name: Client JS budget");

    // build:worker writes the stats file; the boot check needn't wait on a pass here.
    expect(step).toBeGreaterThan(verify.indexOf("- name: Worker bundle budget"));
    expect(step).toBeLessThan(verify.indexOf("bun run smoke:worker"));
    expect(verify.slice(step)).toMatch(
      /^- name: Client JS budget\n\s+if: \$\{\{ inputs\.run-build \|\| inputs\.upload-docs \}\}\n\s+working-directory: packages\/infra\n\s+run: node \.\/node_modules\/\.bin\/tsx client-budget\.ts\n/,
    );
  });
});
