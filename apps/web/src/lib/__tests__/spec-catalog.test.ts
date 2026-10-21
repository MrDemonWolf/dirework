import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_TASK_STYLES, DEFAULT_TIMER_STYLES } from "@dirework/api/config-defaults";
import * as overlayView from "@/lib/overlay-view";

// Source-level contract for design-system/components: one spec per component,
// each pointing at a file that exists, listed row-for-row in the README and the
// docs page, and the overlay specs quoting every real default. A renamed
// component, a new component without a spec, a stale catalog row, or a changed or
// added overlay default fails here until the docs move with it.

const repoRoot = path.resolve(__dirname, "../../../../..");
const specDir = path.join(repoRoot, "design-system/components");
const componentsDir = path.join(repoRoot, "apps/web/src/components");
/** The docs landing widgets: components are the `.tsx` files; `.ts` modules are helpers or generated. */
const docsWidgetsDir = path.join(repoRoot, "apps/fumadocs/src/app/(home)/_widgets");
const read = (file: string) => readFileSync(file, "utf8");

const SECTIONS = [
  "## Purpose",
  "## Anatomy",
  "## Props and variants",
  "## States",
  "## Accessibility",
  "## Do / Don't",
];

interface Spec {
  file: string;
  body: string;
  source: string | undefined;
  tokens: string[] | undefined;
}

function parseSpec(file: string): Spec {
  const body = read(path.join(specDir, file));
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(body)?.[1] ?? "";
  const source = /^source: (.+)$/m.exec(frontmatter)?.[1]?.trim();
  const tokenList = /^tokens: \[(.*)\]$/m.exec(frontmatter)?.[1];
  const tokens =
    tokenList === undefined
      ? undefined
      : tokenList
          .split(",")
          .map((token) => token.trim())
          .filter(Boolean);
  return { file, body, source, tokens };
}

const specs = readdirSync(specDir)
  .filter((file) => file.endsWith(".md") && file !== "README.md")
  .sort()
  .map(parseSpec);

/** Token families a spec may list: `color.*` and `font.*` by group, the rest top-level. */
const tokenJson = JSON.parse(read(path.join(repoRoot, "design-system/tokens.json"))) as Record<
  string,
  Record<string, unknown>
>;
const TOKEN_FAMILIES = new Set(
  Object.entries(tokenJson)
    .filter(([key]) => key !== "$schema" && key !== "meta")
    .flatMap(([key, value]) =>
      key === "color" || key === "font" ? Object.keys(value).map((sub) => `${key}.${sub}`) : [key],
    ),
);

const repoRelative = (full: string) => path.relative(repoRoot, full).split(path.sep).join("/");

/** Every component module under apps/web/src/components, repo-relative. */
function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : componentFiles(full);
    if (!/\.tsx?$/.test(name)) return [];
    if (name === "index.ts" || /\.(test|spec)\.tsx?$/.test(name) || name.includes(".generated."))
      return [];
    return [repoRelative(full)];
  });
}

/**
 * The docs landing widgets: each `.tsx` is a component. Plain `.ts` modules
 * (`theme-util.ts`, `overlay-themes.generated.ts`) are helpers and generated data,
 * excluded by that rule rather than by name, and so is anything generated.
 */
function docsWidgetFiles(): string[] {
  return readdirSync(docsWidgetsDir)
    .filter((name) => name.endsWith(".tsx") && !name.includes(".generated."))
    .map((name) => repoRelative(path.join(docsWidgetsDir, name)));
}

const inventory = () => [...componentFiles(componentsDir), ...docsWidgetFiles()];

/** Rows of a spec's "Pinned values" table: `| \`key\` | \`Source\` | \`value\` |`. */
function pinnedRows(body: string): Map<string, { source: string; value: string }> {
  const rows = new Map<string, { source: string; value: string }>();
  for (const match of body.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|$/gm)) {
    rows.set(match[1] as string, { source: match[2] as string, value: match[3] as string });
  }
  return rows;
}

function valueAt(root: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], root);
}

const PINNED_OBJECTS: Record<string, object> = { DEFAULT_TIMER_STYLES, DEFAULT_TASK_STYLES };

const PINNED_SOURCES: Record<string, (key: string) => unknown> = {
  DEFAULT_TIMER_STYLES: (key) => valueAt(DEFAULT_TIMER_STYLES, key),
  DEFAULT_TASK_STYLES: (key) => valueAt(DEFAULT_TASK_STYLES, key),
  "lib/overlay-view.ts": (key) => (overlayView as Record<string, unknown>)[key],
};

/**
 * Each overlay spec and the defaults object its renderer draws. The required pinned
 * rows are derived, not listed: every leaf of the object, so a changed or added
 * default fails until the spec quotes it. No leaf is excluded — `timer-display.tsx`
 * and `task-list-display.tsx` read every one (layout, colors, fonts, display
 * toggles, scroll speed).
 */
const OVERLAY_SPECS: Record<string, keyof typeof PINNED_OBJECTS> = {
  "timer-ring.md": "DEFAULT_TIMER_STYLES",
  "task-card.md": "DEFAULT_TASK_STYLES",
};

/** Dotted paths of every non-object leaf, e.g. `header.border.radius`. */
function leafKeys(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? leafKeys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** The overlay-view tuning constants: every numeric export, sorted. */
const OVERLAY_VIEW_CONSTANTS = Object.entries(overlayView)
  .filter(([, value]) => typeof value === "number")
  .map(([key]) => key)
  .sort();

const readme = read(path.join(specDir, "README.md"));

/** The README text between two `## ` headings. */
function readmeSection(from: string, to: string): string {
  const start = readme.indexOf(`\n${from}\n`);
  const end = readme.indexOf(`\n${to}\n`, start + 1);
  expect(start, `README has ${from}`).toBeGreaterThan(-1);
  expect(end, `README has ${to} after ${from}`).toBeGreaterThan(start);
  return readme.slice(start, end);
}

/** Spec files a README section links, in order; a link's text must be its file's stem. */
function readmeLinks(section: string): string[] {
  return [...section.matchAll(/\[([^\]]+)\]\(\.\/([^)]+\.md)\)/g)].map(([, text, file]) => {
    expect(`${text}.md`, `README link text for ${file}`).toBe(file);
    return file as string;
  });
}

/**
 * The docs page's Spec | Component | Source rows, from the table under "Sources are
 * relative to…" up to "### Legacy" (whose removed-spec rows are not the catalog).
 * Sources resolve against `apps/web/src/components/` unless they start with `apps/`.
 */
const docsCatalog = (() => {
  const docs = read(path.join(repoRoot, "apps/fumadocs/content/docs/design-system.mdx"));
  const start = docs.indexOf("Sources are relative to `apps/web/src/components/`");
  const end = docs.indexOf("### Legacy", start);
  const rows = new Map<string, string>();
  const duplicates: string[] = [];
  if (start === -1 || end === -1) return { rows, duplicates };
  for (const [, file, source] of docs
    .slice(start, end)
    .matchAll(/^\| `([^`]+\.md)` \| [^|]+ \| `([^`]+)` \|$/gm)) {
    const full = source?.startsWith("apps/") ? source : `apps/web/src/components/${source}`;
    if (rows.has(file as string)) duplicates.push(file as string);
    rows.set(file as string, full);
  }
  return { rows, duplicates };
})();

describe("design-system component spec catalog", () => {
  it("finds the specs and the components", () => {
    expect(specs.length).toBeGreaterThan(40);
    expect(componentFiles(componentsDir).length).toBeGreaterThan(40);
    expect(docsWidgetFiles().length).toBeGreaterThan(0);
  });

  it("documents only inventoried components", () => {
    const known = new Set(inventory());
    const strays = specs.filter((spec) => spec.source && !known.has(spec.source));
    expect(
      strays.map((spec) => `${spec.file} -> ${spec.source}`),
      "specs whose source is outside the inventory",
    ).toEqual([]);
  });

  it.each(specs.map((spec) => [spec.file, spec] as const))(
    "%s has frontmatter whose source exists and whose tokens are real families",
    (_file, spec) => {
      expect(spec.source, "frontmatter `source:` line").toBeDefined();
      expect(existsSync(path.join(repoRoot, spec.source as string)), spec.source).toBe(true);
      expect(spec.tokens, "frontmatter `tokens: [...]` line").toBeDefined();
      for (const token of spec.tokens ?? []) expect(TOKEN_FAMILIES).toContain(token);
    },
  );

  it.each(specs.map((spec) => [spec.file, spec] as const))(
    "%s has every section, in order",
    (_file, spec) => {
      const positions = SECTIONS.map((heading) =>
        spec.body.search(new RegExp(`^${heading}$`, "m")),
      );
      for (const [index, position] of positions.entries())
        expect(position, SECTIONS[index]).toBeGreaterThan(-1);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    },
  );

  it("references every component file from exactly one spec", () => {
    const bySource = new Map<string, string[]>();
    for (const spec of specs) {
      if (!spec.source) continue;
      bySource.set(spec.source, [...(bySource.get(spec.source) ?? []), spec.file]);
    }
    const missing = inventory().filter((file) => !bySource.has(file));
    expect(missing, "components without a spec").toEqual([]);
    const shared = [...bySource].filter(([, files]) => files.length > 1);
    expect(shared, "sources claimed by more than one spec").toEqual([]);
  });

  it("lists every spec in the docs page with its exact source", () => {
    const expected = new Map(specs.map((spec) => [spec.file, spec.source]));
    expect(docsCatalog.duplicates, "specs listed twice in design-system.mdx").toEqual([]);
    expect(Object.fromEntries(docsCatalog.rows), "design-system.mdx Spec -> Source rows").toEqual(
      Object.fromEntries(expected),
    );
  });

  it("files every spec in exactly one README catalog group", () => {
    const filed = readmeLinks(readmeSection("## Catalog", "## Principles"));
    expect([...filed].sort(), "README catalog entries").toEqual(specs.map((spec) => spec.file));
    const twice = [...filed].filter((file, index) => filed.indexOf(file) !== index);
    expect(twice, "specs filed in more than one catalog group").toEqual([]);
  });

  it("maps every spec to a page in the README", () => {
    const mapped = new Set(readmeLinks(readmeSection("## Page to components", "## Catalog")));
    const known = new Set(specs.map((spec) => spec.file));
    expect(
      specs.map((spec) => spec.file).filter((file) => !mapped.has(file)),
      "specs missing from the page map",
    ).toEqual([]);
    expect(
      [...mapped].filter((file) => !known.has(file)),
      "page map links to no spec",
    ).toEqual([]);
  });

  it("pins every overlay-view constant in exactly one overlay spec", () => {
    const pinned = Object.keys(OVERLAY_SPECS).flatMap((file) =>
      [...pinnedRows(read(path.join(specDir, file)))]
        .filter(([, row]) => row.source === "lib/overlay-view.ts")
        .map(([key]) => key),
    );
    expect(pinned.sort()).toEqual(OVERLAY_VIEW_CONSTANTS);
  });

  it.each(Object.entries(OVERLAY_SPECS))(
    "%s pins every default its renderer reads, at its real value",
    (file, defaultsName) => {
      const rows = pinnedRows(read(path.join(specDir, file)));
      const pinnedDefaults = [...rows]
        .filter(([, row]) => row.source === defaultsName)
        .map(([key]) => key);
      const required = leafKeys(PINNED_OBJECTS[defaultsName]);
      expect(pinnedDefaults.sort(), `${file} pins exactly the ${defaultsName} leaves`).toEqual(
        [...required].sort(),
      );
      for (const [key, { source, value }] of rows) {
        const lookup = PINNED_SOURCES[source];
        expect(lookup, `${file}: unknown source ${source}`).toBeDefined();
        const actual = lookup?.(key);
        expect(actual, `${file}: ${source} has no ${key}`).toBeDefined();
        expect(value, `${file}: ${key}`).toBe(String(actual));
      }
    },
  );
});
