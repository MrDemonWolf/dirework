import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// What the browser must not download (AGENTS.md "Browser-bundled web code"):
// - the D1 schema, which drags drizzle-orm, every table, cuid2/@noble/hashes and a Buffer
//   polyfill into the chunk that imports it. Never, on any page;
// - zod, and config-shared, which builds its zod schemas as it loads. Only the two pages
//   that validate a save with the server's own input schema load them (ZOD_PAGES).
// One value import was enough to ship all of it to every route: the root providers
// imported TRPC_MAX_BATCH_SIZE from config-shared, which re-exported SINGLETON_ID from the
// schema. Browser code reads constants and helpers from the zod-free modules instead
// (config-defaults, chat-text, chat-commands, bot-lease, bot-permissions, style-limits).
//
// The walk follows every static value import from each route entry, through the workspace
// packages' source (resolved through their `exports` maps), so a new import that reaches a
// forbidden module fails here and names the chain. A type-only import is erased, so it is
// not followed. Bare npm packages are leaves (not walked into). Server components are walked
// too: what they reach is in the web Worker's SSR bundle, which ships the same code.
// A dynamic `import()` starts a separate chunk, outside a route's first load, so it is not
// followed.

const webSrc = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

// ── Static imports of one module ────────────────────────────────────────────

interface StaticImport {
  specifier: string;
  /** `import type …` / `export type … from`: erased at compile time, loads nothing. */
  typeOnly: boolean;
}

/** An import or export declaration starts its line (Biome formats every module). */
const DECLARATION = /^[ \t]*(import|export)\b/gm;
const IDENT_START = /[A-Za-z_$]/;
const IDENT_CHAR = /[\w$]/;

/** The next significant index: whitespace and comments skipped. */
function skipTrivia(src: string, from: number): number {
  let i = from;
  for (;;) {
    while (i < src.length && /\s/.test(src.charAt(i))) i++;
    if (src.startsWith("//", i)) {
      const end = src.indexOf("\n", i);
      i = end < 0 ? src.length : end;
    } else if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
    } else {
      return i;
    }
  }
}

function readWord(src: string, from: number): string {
  let i = from;
  while (i < src.length && IDENT_CHAR.test(src.charAt(i))) i++;
  return src.slice(from, i);
}

function readSpecifier(src: string, from: number): string | null {
  const quote = src.charAt(from);
  if (quote !== '"' && quote !== "'") return null;
  const end = src.indexOf(quote, from + 1);
  return end < 0 ? null : src.slice(from + 1, end);
}

/**
 * The module an `import`/`export` declaration at `from` loads, or null when it loads none
 * (`export const`, `export { local }`, `import.meta`, a dynamic `import()`).
 * `import { type A } from "x"` counts as a value import: under verbatimModuleSyntax it
 * still compiles to `import {} from "x"`, which runs the module.
 */
function readDeclaration(src: string, keyword: string, from: number): StaticImport | null {
  let i = skipTrivia(src, from);
  if (keyword === "import") {
    const sideEffect = readSpecifier(src, i);
    if (sideEffect !== null) return { specifier: sideEffect, typeOnly: false };
  }
  let typeOnly = false;
  if (readWord(src, i) === "type") {
    const next = skipTrivia(src, i + 4);
    const word = readWord(src, next);
    // `import type X from` / `type { … }` / `type *`; not a default import named "type".
    if (src[next] === "{" || src[next] === "*" || (word !== "" && word !== "from")) {
      typeOnly = true;
      i = next;
    }
  }
  if (keyword === "export" && src[i] !== "{" && src[i] !== "*") return null;
  let depth = 0;
  while (i < src.length) {
    i = skipTrivia(src, i);
    const c = src.charAt(i);
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (IDENT_START.test(c)) {
      const word = readWord(src, i);
      if (word === "from" && depth === 0) {
        const specifier = readSpecifier(src, skipTrivia(src, i + word.length));
        return specifier === null ? null : { specifier, typeOnly };
      }
      i += word.length;
      continue;
    } else if (c !== "," && c !== "*") {
      return null;
    }
    i++;
  }
  return null;
}

/** Every `import … from`, `import "…"` and `export … from` in a module's source, in order. */
function staticImports(source: string): StaticImport[] {
  const found: StaticImport[] = [];
  for (const match of source.matchAll(DECLARATION)) {
    const declaration = readDeclaration(source, match[1] ?? "", match.index + match[0].length);
    if (declaration) found.push(declaration);
  }
  return found;
}

// ── Resolution: @/ alias, relative paths, workspace packages' exports maps ──

interface WorkspacePackage {
  dir: string;
  exports: Record<string, unknown>;
}

const packages = new Map<string, WorkspacePackage>();
for (const group of ["apps", "packages"]) {
  for (const name of readdirSync(path.join(repoRoot, group))) {
    const manifest = path.join(repoRoot, group, name, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
      name?: string;
      exports?: Record<string, unknown>;
    };
    if (pkg.name)
      packages.set(pkg.name, { dir: path.dirname(manifest), exports: pkg.exports ?? {} });
  }
}

/** A conditional export's target, preferring the conditions a browser bundle picks. */
function exportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return undefined;
  for (const condition of ["browser", "import", "default"]) {
    const target = exportTarget((value as Record<string, unknown>)[condition]);
    if (target) return target;
  }
  return undefined;
}

/** Node's subpath lookup: an exact key, else the one-`*` pattern with the longest prefix. */
function resolveExport(pkg: WorkspacePackage, subpath: string): string | undefined {
  if (Object.hasOwn(pkg.exports, subpath)) return exportTarget(pkg.exports[subpath]);
  let best: { prefix: string; target: string } | undefined;
  for (const [key, value] of Object.entries(pkg.exports)) {
    const star = key.indexOf("*");
    if (star < 0 || key.includes("*", star + 1)) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    const matches =
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix) &&
      subpath.length >= prefix.length + suffix.length;
    const target = exportTarget(value);
    if (!matches || !target || (best && best.prefix.length >= prefix.length)) continue;
    const captured = subpath.slice(prefix.length, subpath.length - suffix.length);
    best = { prefix, target: target.replaceAll("*", captured) };
  }
  return best?.target;
}

function sourceFile(base: string): string | undefined {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile());
}

/** Styles, images, fonts and JSON load no modules. */
const ASSET = /\.(css|json|svg|png|jpe?g|webp|woff2?)$/;

/**
 * The absolute source file `specifier` loads from `importer`, `npm:<name>` for a package
 * outside the workspace, or null for an asset. Throws when a source import can't be
 * resolved, so the walk never silently stops short.
 */
function resolveImport(specifier: string, importer: string): string | null {
  if (ASSET.test(specifier)) return null;
  let base: string;
  if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(importer), specifier);
  } else if (specifier.startsWith("@/")) {
    base = path.join(webSrc, specifier.slice(2));
  } else {
    const parts = specifier.split("/");
    const name = (specifier.startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1)).join("/");
    const pkg = packages.get(name);
    if (!pkg) return `npm:${name}`;
    const target = resolveExport(pkg, `.${specifier.slice(name.length)}`);
    if (!target) throw new Error(`${name} does not export ${specifier} (imported by ${importer})`);
    base = path.join(pkg.dir, target);
  }
  const file = sourceFile(base);
  if (!file) throw new Error(`Cannot resolve ${specifier} from ${importer}`);
  return file;
}

// ── The walk ────────────────────────────────────────────────────────────────

const valueImportCache = new Map<string, string[]>();

function valueImports(file: string): string[] {
  let deps = valueImportCache.get(file);
  if (!deps) {
    deps = staticImports(readFileSync(file, "utf8"))
      .filter(({ typeOnly }) => !typeOnly)
      .map(({ specifier }) => resolveImport(specifier, file))
      .filter((dep): dep is string => dep !== null);
    valueImportCache.set(file, deps);
  }
  return deps;
}

const label = (node: string) =>
  node.startsWith("npm:") ? node.slice(4) : path.relative(repoRoot, node).split(path.sep).join("/");

/** The shortest import chain from `entry` to each module `isForbidden` matches, as "a → b → c". */
function forbiddenChains(entry: string, isForbidden: (node: string) => boolean): string[] {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  const chains: string[] = [];
  for (let node = queue.shift(); node !== undefined; node = queue.shift()) {
    if (isForbidden(node)) {
      const chain: string[] = [];
      for (let at: string | null | undefined = node; at; at = parent.get(at)) {
        chain.unshift(label(at));
      }
      chains.push(chain.join(" → "));
    }
    if (node.startsWith("npm:")) continue;
    for (const dep of valueImports(node)) {
      if (parent.has(dep)) continue;
      parent.set(dep, node);
      queue.push(dep);
    }
  }
  return chains;
}

// ── What must stay out ──────────────────────────────────────────────────────

const DB_SCHEMA_DIR = path.join(repoRoot, "packages/db/src/schema") + path.sep;
const DB_CLIENT = path.join(repoRoot, "packages/db/src/index.ts");

/** The D1 schema or the db client, and the packages only they pull in. */
function isDbSchema(node: string): boolean {
  return (
    node.startsWith(DB_SCHEMA_DIR) ||
    node === DB_CLIENT ||
    node === "npm:drizzle-orm" ||
    node === "npm:@paralleldrive/cuid2"
  );
}

const CONFIG_SHARED = path.join(repoRoot, "packages/api/src/config-shared.ts");

/** zod, or config-shared (which builds its zod schemas at module scope). */
function isZodOrConfigShared(node: string): boolean {
  return node === "npm:zod" || node === CONFIG_SHARED;
}

/**
 * The pages that check a save against the server's own input schema before sending it
 * (Theme Center: `updateStylesInput`, Replies: `updateBotSettingsInput`), so they load zod
 * by design. The DB schema stays out of them too.
 */
const ZOD_PAGES = [
  "app/(app)/dashboard/styles/page.tsx",
  "app/(app)/dashboard/bot/(sections)/replies/page.tsx",
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

/** Every file Next turns into a route's client entry: pages, layouts and their boundaries. */
const ROUTE_FILE = /^(page|layout|loading|error|global-error|not-found|template|default)\.tsx$/;

const rel = (file: string) => path.relative(webSrc, file).split(path.sep).join("/");

const ENTRIES = [
  ...filesUnder(path.join(webSrc, "app"))
    .filter((file) => ROUTE_FILE.test(path.basename(file)))
    .map(rel)
    .sort(),
  // The client providers and the tRPC clients the pages share.
  "components/providers.tsx",
  "components/overlay-query-provider.tsx",
  "utils/query-client.ts",
  "utils/trpc.ts",
  "utils/public-trpc.ts",
];

describe("staticImports", () => {
  it("keeps value imports and re-exports, and drops type-only ones and local exports", () => {
    const source = [
      'import { a } from "./value";',
      'import type { B } from "./types";',
      "import {",
      "  c, // a comment inside the clause",
      "  /* another */ d,",
      '} from "./multi-line";',
      'import { type E, f } from "./mixed";',
      'import "./side-effect.css";',
      'import type from "./default-named-type";',
      'export { g } from "./re-export";',
      'export type { H } from "./type-re-export";',
      'export * as ns from "./star";',
      "export type I = { from: string };",
      "export const j = 1;",
      "export { j as k };",
      'const lazy = () => import("./dynamic");',
      "const meta = import.meta.url;",
    ].join("\n");
    expect(staticImports(source)).toEqual([
      { specifier: "./value", typeOnly: false },
      { specifier: "./types", typeOnly: true },
      { specifier: "./multi-line", typeOnly: false },
      { specifier: "./mixed", typeOnly: false },
      { specifier: "./side-effect.css", typeOnly: false },
      { specifier: "./default-named-type", typeOnly: false },
      { specifier: "./re-export", typeOnly: false },
      { specifier: "./type-re-export", typeOnly: true },
      { specifier: "./star", typeOnly: false },
    ]);
  });
});

describe("browser import graph", () => {
  it("covers the root, landing, setup, dashboard, Bot settings, overlay and bot entries", () => {
    expect(ENTRIES).toEqual(
      expect.arrayContaining([
        "app/layout.tsx",
        "app/(app)/layout.tsx",
        "app/(app)/page.tsx",
        "app/(app)/setup/page.tsx",
        "app/(app)/dashboard/page.tsx",
        "app/(app)/dashboard/bot/(sections)/layout.tsx",
        "app/(app)/dashboard/bot/(sections)/page.tsx",
        "app/(app)/dashboard/bot/(sections)/commands/page.tsx",
        "app/(app)/dashboard/bot/(sections)/moderation/page.tsx",
        "app/(overlay)/overlay/t/[token]/page.tsx",
        "app/(overlay)/overlay/l/[token]/page.tsx",
        "app/(bot)/bot/[token]/page.tsx",
        "components/providers.tsx",
        "utils/trpc.ts",
        // A renamed page must not leave its exemption behind.
        ...ZOD_PAGES,
      ]),
    );
  });

  // The walker must see a real import of the schema, or every case below passes vacuously.
  it("finds the schema where server code imports it", () => {
    const service = path.join(repoRoot, "packages/api/src/services/singleton.ts");
    expect(forbiddenChains(service, isDbSchema)).toContain(
      "packages/api/src/services/singleton.ts → packages/db/src/schema/index.ts",
    );
  });

  it.each(ENTRIES)("%s reaches no DB schema", (entry) => {
    expect(forbiddenChains(path.join(webSrc, entry), isDbSchema)).toEqual([]);
  });

  // Also proves the walker sees zod. A page that stops loading it leaves ZOD_PAGES.
  it.each(ZOD_PAGES)("%s loads zod, for its Save-time check", (entry) => {
    expect(forbiddenChains(path.join(webSrc, entry), isZodOrConfigShared)).toContainEqual(
      expect.stringMatching(/ → zod$/),
    );
  });

  it.each(ENTRIES.filter((entry) => !ZOD_PAGES.includes(entry)))(
    "%s reaches neither zod nor config-shared",
    (entry) => {
      expect(forbiddenChains(path.join(webSrc, entry), isZodOrConfigShared)).toEqual([]);
    },
  );
});

// ── What the token pages load ───────────────────────────────────────────────
//
// The OBS overlays and the bot page (the token pages an OBS source, Moblin or a dock keeps open
// all stream) show no toasts and no Theme Center, so they must not load the toast host or the
// preset table: sonner, the query-error toast, the six presets and, through the presets'
// isDeepEqual, lib/utils' tailwind-merge and clsx. Every route renders the root layout, so its
// imports count for each token page (the client providers are mounted by the group layouts,
// which are entries of their own). The (app) shell is the control: the same walk reaches the
// toast host from there.

const src = (file: string) => path.join(webSrc, file);

const ROOT_ENTRIES = ["app/layout.tsx"];
const OVERLAY_ENTRIES = ENTRIES.filter((entry) => entry.startsWith("app/(overlay)/"));
const BOT_ENTRIES = ENTRIES.filter((entry) => entry.startsWith("app/(bot)/"));
const TOKEN_PAGE_ENTRIES = [...ROOT_ENTRIES, ...OVERLAY_ENTRIES, ...BOT_ENTRIES];

/** The toast host: sonner, its Toaster, and the query-error toast it registers. */
const TOAST_HOST = [
  "npm:sonner",
  src("components/ui/sonner.tsx"),
  src("components/app-toaster.tsx"),
  src("lib/query-error-toast.ts"),
];
const THEME_PRESETS = src("lib/theme-presets.ts");
/** lib/utils' `cn`, which the presets' isDeepEqual pulled in with it. */
const CLASS_MERGING = [src("lib/utils.ts"), "npm:tailwind-merge", "npm:clsx"];

const oneOf = (modules: string[]) => (node: string) => modules.includes(node);

describe("what the token pages load", () => {
  it("covers both overlays and the bot page, with their group layouts", () => {
    expect(TOKEN_PAGE_ENTRIES).toEqual(
      expect.arrayContaining([
        "app/(overlay)/layout.tsx",
        "app/(overlay)/overlay/t/[token]/page.tsx",
        "app/(overlay)/overlay/l/[token]/page.tsx",
        "app/(bot)/layout.tsx",
        "app/(bot)/bot/[token]/page.tsx",
      ]),
    );
  });

  it.each(TOKEN_PAGE_ENTRIES)("%s loads no toast host and no presets", (entry) => {
    expect(forbiddenChains(src(entry), oneOf([...TOAST_HOST, THEME_PRESETS]))).toEqual([]);
  });

  // The bot dock's buttons use `cn`, so only the overlays (and what every route loads) are held
  // to this.
  it.each([...ROOT_ENTRIES, ...OVERLAY_ENTRIES])("%s loads no tailwind-merge or clsx", (entry) => {
    expect(forbiddenChains(src(entry), oneOf(CLASS_MERGING))).toEqual([]);
  });

  it("follows the edges it checks: the (app) shell reaches the toast host and the overlay its defaults", () => {
    expect(forbiddenChains(src("app/(app)/layout.tsx"), oneOf(TOAST_HOST))).toHaveLength(
      TOAST_HOST.length,
    );
    const defaults = [
      src("lib/overlay-view.ts"),
      path.join(repoRoot, "packages/api/src/config-defaults.ts"),
    ];
    expect(
      forbiddenChains(src("app/(overlay)/overlay/t/[token]/page.tsx"), oneOf(defaults)),
    ).toHaveLength(defaults.length);
  });
});

describe("the toast host", () => {
  it("is mounted once, by the (app) layout", () => {
    const mounts = filesUnder(webSrc)
      .filter((file) => /\.tsx$/.test(file) && !file.includes(`${path.sep}__tests__${path.sep}`))
      .filter((file) => readFileSync(file, "utf8").includes("<Toaster"))
      .map(rel);
    expect(mounts).toEqual(["components/app-toaster.tsx"]);
    expect(readFileSync(src("app/(app)/layout.tsx"), "utf8")).toContain("<AppToaster />");
  });
});

// ── Providers only where they're used ───────────────────────────────────────
//
// The root layout mounts no client providers. The (app) layout mounts the theme and React
// Query (the dashboard uses both), the (overlay) layout only a QueryClientProvider (the
// overlays poll with useQuery but never read the theme; the head script still sets the class),
// and the (bot) layout neither: the bot page calls the plain publicTrpc client and pins the
// dark tokens. So a token page loads no next-themes, the bot page no React Query, and neither
// the /rpc options proxy or the devtools.

const THEME_RUNTIME = ["npm:next-themes", src("components/theme-provider.tsx")];
const REACT_QUERY = ["npm:@tanstack/react-query", "npm:@tanstack/react-query-devtools"];
const RPC_OPTIONS_PROXY = [
  "npm:@trpc/tanstack-react-query",
  "npm:@tanstack/react-query-devtools",
  src("utils/trpc.ts"),
];

describe("providers only where they're used", () => {
  it.each(["app/layout.tsx", ...OVERLAY_ENTRIES, ...BOT_ENTRIES])(
    "%s loads no theme provider",
    (entry) => {
      expect(forbiddenChains(src(entry), oneOf(THEME_RUNTIME))).toEqual([]);
    },
  );

  it.each(["app/layout.tsx", ...BOT_ENTRIES])("%s loads no React Query", (entry) => {
    expect(forbiddenChains(src(entry), oneOf(REACT_QUERY))).toEqual([]);
  });

  it.each(OVERLAY_ENTRIES)("%s loads no /rpc options proxy or devtools", (entry) => {
    expect(forbiddenChains(src(entry), oneOf(RPC_OPTIONS_PROXY))).toEqual([]);
  });

  it("follows the edges it checks: the (app) shell reaches the theme provider and React Query", () => {
    expect(forbiddenChains(src("app/(app)/layout.tsx"), oneOf(THEME_RUNTIME))).toHaveLength(
      THEME_RUNTIME.length,
    );
    expect(forbiddenChains(src("app/(app)/layout.tsx"), oneOf(REACT_QUERY))).toHaveLength(
      REACT_QUERY.length,
    );
    expect(
      forbiddenChains(
        src("app/(overlay)/overlay/t/[token]/page.tsx"),
        oneOf(["npm:@tanstack/react-query"]),
      ),
    ).toHaveLength(1);
  });
});
