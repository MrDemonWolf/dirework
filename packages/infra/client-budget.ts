/**
 * Per-route client JS budget, run by verify.yml right after the Worker bundle
 * budget (`node ./node_modules/.bin/tsx client-budget.ts` from packages/infra).
 * bundle-budget.ts measures what Cloudflare stores; this measures what a
 * browser downloads before a page runs: OBS loading an overlay, the bot page,
 * a viewer opening the landing.
 *
 * Source: apps/web/.next/diagnostics/route-bundle-stats.json, which Next writes
 * on every Turbopack build (`build:worker` runs one). Each row names an app
 * route and the `firstLoadChunkPaths` its first load fetches: its page and
 * layouts plus the shared runtime. Each chunk is gzipped once, at level 9 like
 * the 2026-11 audit's measurements, and summed per route: a fixed yardstick,
 * not the exact bytes on the wire. The file is an undocumented diagnostic, so
 * a missing or reshaped file fails the step instead of quietly turning the
 * check off after a Next upgrade.
 *
 * Fails when a route is over its budget, when a route has no budget, or when a
 * budget names a route the build no longer has. With ENFORCE_FORBIDDEN_MARKERS
 * on, it also fails when zod or the D1 schema shows up in a token page's or the
 * landing's chunks.
 *
 * The pure parts are unit-tested; main() runs only when this file is the
 * entrypoint.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { constants, gzipSync } from "node:zlib";

/** Where Next writes the per-route first-load stats, relative to apps/web. */
export const ROUTE_STATS_PATH = ".next/diagnostics/route-bundle-stats.json";

/** Route → first-load JS budget in KiB (gzip -9), under a group naming who loads it. */
export type ClientBudgets = Readonly<Record<string, Readonly<Record<string, number>>>>;

/**
 * First-load client JS per route, KiB gzip -9. Each budget sits about 3% above
 * the size this script printed when it was set, rounded up to a whole KiB. A PR
 * that shrinks a route lowers its budget the same way. Raising one needs a
 * stated reason in the PR, never just to turn a red run green.
 */
export const CLIENT_JS_BUDGETS_KIB = {
  // OBS browser sources and the bot page, loaded on the streaming PC.
  "token pages": {
    "/overlay/t/[token]": 251,
    "/overlay/l/[token]": 253,
    "/bot/[token]": 289,
  },
  // A viewer's first look, the claim page and the 404.
  "public pages": {
    "/": 328,
    "/setup": 328,
    "/_not-found": 230,
  },
  // Owner only.
  dashboard: {
    "/dashboard": 391,
    "/dashboard/styles": 405,
    "/dashboard/bot": 381,
    "/dashboard/bot/commands": 369,
    "/dashboard/bot/moderation": 369,
    "/dashboard/bot/replies": 379,
  },
} as const satisfies ClientBudgets;

/**
 * Strings only zod (`ZodError`) and drizzle (the `drizzle:Name` symbol on every
 * table) put in a bundle. Either one in a scanned route's chunks means zod or
 * the D1 schema reached that page.
 */
export const FORBIDDEN_MARKERS = ["ZodError", "drizzle:Name"] as const;

/**
 * Every token page plus the landing. The dashboard is not scanned: Theme Center
 * and Replies validate their drafts with the save schemas, so zod loads there
 * by design.
 */
export const FORBIDDEN_MARKER_ROUTES: readonly string[] = [
  ...Object.keys(CLIENT_JS_BUDGETS_KIB["token pages"]),
  "/",
];

/**
 * Off for now, so the marker scan only reports: utils/trpc.ts value-imports
 * @dirework/api/config-shared, which puts zod and the D1 schema in the root
 * layout chunk of every route.
 * TODO(W2-3): turn this on in the PR that moves the browser-used helpers out of
 * config-shared, so the token pages and the landing stay free of both.
 */
export const ENFORCE_FORBIDDEN_MARKERS = false;

/** The fields this check reads from one row of route-bundle-stats.json. */
export interface RouteBundleStat {
  route: string;
  /** Paths relative to apps/web, e.g. `.next/static/chunks/<hash>.js`. */
  firstLoadChunkPaths: string[];
}

export interface RouteSize {
  route: string;
  /** Sum of the gzip -9 size of each first-load chunk. */
  gzipBytes: number;
  /** Each forbidden marker found in the route's chunks, with the chunk carrying it. */
  markers: { marker: string; chunk: string }[];
}

export interface BudgetRow {
  route: string;
  /** The budget table's group, or null for a route without a budget. */
  group: string | null;
  /** First-load JS in KiB gzip -9, two decimals. */
  kib: number;
  budgetKib: number | null;
}

export interface ClientBudgetResult {
  /** Budgeted routes in table order, then any route without a budget. */
  rows: BudgetRow[];
  errors: string[];
  /** Forbidden markers found while enforcement is off: printed, not failed. */
  notes: string[];
}

function isRouteBundleStat(row: unknown): row is RouteBundleStat {
  if (typeof row !== "object" || row === null) return false;
  const { route, firstLoadChunkPaths } = row as Record<string, unknown>;
  return (
    typeof route === "string" &&
    Array.isArray(firstLoadChunkPaths) &&
    firstLoadChunkPaths.length > 0 &&
    firstLoadChunkPaths.every((chunk) => typeof chunk === "string")
  );
}

/** Parse route-bundle-stats.json; throws unless it is a non-empty list of the rows this check reads. */
export function parseRouteBundleStats(text: string): RouteBundleStat[] {
  let rows: unknown;
  try {
    rows = JSON.parse(text);
  } catch {
    rows = undefined;
  }
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isRouteBundleStat)) {
    throw new Error(
      `${ROUTE_STATS_PATH} is not the list of { route, firstLoadChunkPaths } rows this check reads. Next writes it as an undocumented diagnostic: if an upgrade changed it, update packages/infra/client-budget.ts rather than skip the check.`,
    );
  }
  return rows.map(({ route, firstLoadChunkPaths }) => ({ route, firstLoadChunkPaths }));
}

/**
 * Gzip each first-load chunk once (most are shared by several routes), scan it
 * once for `markers`, and sum the sizes per route.
 */
export function measureRoutes(
  stats: readonly RouteBundleStat[],
  readChunk: (chunkPath: string) => Buffer,
  markers: readonly string[] = FORBIDDEN_MARKERS,
): RouteSize[] {
  const chunks = new Map<string, { gzipBytes: number; markers: string[] }>();
  const measure = (chunkPath: string) => {
    let chunk = chunks.get(chunkPath);
    if (!chunk) {
      const bytes = readChunk(chunkPath);
      chunk = {
        gzipBytes: gzipSync(bytes, { level: constants.Z_BEST_COMPRESSION }).length,
        markers: markers.filter((marker) => bytes.includes(marker)),
      };
      chunks.set(chunkPath, chunk);
    }
    return chunk;
  };

  return stats.map(({ route, firstLoadChunkPaths }) => {
    const size: RouteSize = { route, gzipBytes: 0, markers: [] };
    // A browser fetches a chunk once, however often a route lists it.
    for (const chunkPath of new Set(firstLoadChunkPaths)) {
      const chunk = measure(chunkPath);
      size.gzipBytes += chunk.gzipBytes;
      for (const marker of chunk.markers) size.markers.push({ marker, chunk: chunkPath });
    }
    return size;
  });
}

function toKib(bytes: number): number {
  return Number((bytes / 1024).toFixed(2));
}

function evaluateBudgets(
  sizes: readonly RouteSize[],
  budgets: ClientBudgets,
  enforceMarkers: boolean,
): ClientBudgetResult {
  const byRoute = new Map(sizes.map((size) => [size.route, size]));
  const result: ClientBudgetResult = { rows: [], errors: [], notes: [] };

  for (const [group, routes] of Object.entries(budgets)) {
    for (const [route, budgetKib] of Object.entries(routes)) {
      const size = byRoute.get(route);
      if (!size) {
        result.errors.push(
          `${route}: has a budget but the build has no such route. Rename or remove it in CLIENT_JS_BUDGETS_KIB.`,
        );
        continue;
      }
      const kib = toKib(size.gzipBytes);
      result.rows.push({ route, group, kib, budgetKib });
      if (kib > budgetKib) {
        result.errors.push(
          `${route}: ${kib.toFixed(2)} KiB gzip, over its ${budgetKib} KiB budget by ${(kib - budgetKib).toFixed(2)} KiB. Trim the route's client JS, or raise its budget in CLIENT_JS_BUDGETS_KIB with a reason in the PR.`,
        );
      }
    }
  }

  const budgeted = new Set(Object.values(budgets).flatMap((routes) => Object.keys(routes)));
  for (const { route, gzipBytes } of sizes) {
    if (budgeted.has(route)) continue;
    const kib = toKib(gzipBytes);
    result.rows.push({ route, group: null, kib, budgetKib: null });
    result.errors.push(
      `${route}: no budget. Add it to CLIENT_JS_BUDGETS_KIB about 3% above ${kib.toFixed(2)} KiB.`,
    );
  }

  for (const route of FORBIDDEN_MARKER_ROUTES) {
    for (const { marker, chunk } of byRoute.get(route)?.markers ?? []) {
      (enforceMarkers ? result.errors : result.notes).push(
        `${route} ships ${marker} (${chunk}): zod or the D1 schema reached a token page or the landing. Import the value from a zod-free module instead.`,
      );
    }
  }
  return result;
}

/**
 * Measure the build in `webDir` (apps/web after `build:worker`) against the
 * budgets. Throws when there is nothing to measure: no stats file, a reshaped
 * one, or a listed chunk that is missing.
 */
export function checkClientBudget({
  webDir,
  budgets = CLIENT_JS_BUDGETS_KIB,
  enforceMarkers = ENFORCE_FORBIDDEN_MARKERS,
}: {
  webDir: string;
  budgets?: ClientBudgets;
  enforceMarkers?: boolean;
}): ClientBudgetResult {
  const statsFile = path.join(webDir, ROUTE_STATS_PATH);
  if (!existsSync(statsFile)) {
    throw new Error(
      `No ${ROUTE_STATS_PATH} in ${webDir}. Run \`bun run build:worker\` in apps/web first (verify.yml does, before this step). Next writes the file on every Turbopack build; it is undocumented, so if an upgrade stopped writing it, this check needs a new source, not a skip.`,
    );
  }
  const stats = parseRouteBundleStats(readFileSync(statsFile, "utf8"));
  const sizes = measureRoutes(stats, (chunkPath) => {
    const file = path.join(webDir, chunkPath);
    if (!existsSync(file)) {
      throw new Error(
        `${chunkPath} is listed in ${ROUTE_STATS_PATH} but missing, so the stats and the chunks come from different builds. Rebuild with \`bun run build:worker\`.`,
      );
    }
    return readFileSync(file);
  });
  return evaluateBudgets(sizes, budgets, enforceMarkers);
}

/** The per-route report, as a Markdown table (the CI log and the job summary). */
export function formatBudgetTable(rows: readonly BudgetRow[]): string {
  const lines = [
    "| Route | Group | KiB gzip | Budget | Headroom |",
    "| --- | --- | ---: | ---: | ---: |",
  ];
  for (const { route, group, kib, budgetKib } of rows) {
    const headroom = budgetKib === null ? "none" : (budgetKib - kib).toFixed(2);
    lines.push(
      `| \`${route}\` | ${group ?? "none"} | ${kib.toFixed(2)} | ${budgetKib ?? "none"} | ${headroom} |`,
    );
  }
  return lines.join("\n");
}

function main(): void {
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web");
  let result: ClientBudgetResult;
  try {
    result = checkClientBudget({ webDir });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const table = formatBudgetTable(result.rows);
  console.log(`First-load client JS per route (KiB gzip -9):\n\n${table}\n`);
  if (result.notes.length > 0) {
    console.log(
      `Forbidden markers, reported only while ENFORCE_FORBIDDEN_MARKERS is off:\n- ${result.notes.join("\n- ")}\n`,
    );
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(
      summary,
      `### Client JS budget\n\nFirst-load JS per route, KiB gzip -9. Budgets: \`CLIENT_JS_BUDGETS_KIB\` in packages/infra/client-budget.ts.\n\n${table}\n`,
    );
  }

  if (result.errors.length > 0) {
    console.error(`Client JS budget exceeded:\n- ${result.errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Client JS budget check passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
