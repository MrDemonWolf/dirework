import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_TASK_STYLES, DEFAULT_TIMER_STYLES } from "@dirework/api/config-defaults";
import * as overlayView from "@/lib/overlay-view";

// Source-level contract for design-system/components: one spec per component,
// each pointing at a file that exists, and the overlay specs quoting the real
// defaults. A renamed component, a new component without a spec, or a changed
// overlay default fails here until the spec moves with it.

const repoRoot = path.resolve(__dirname, "../../../../..");
const specDir = path.join(repoRoot, "design-system/components");
const componentsDir = path.join(repoRoot, "apps/web/src/components");
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

/** Every component module under apps/web/src/components, repo-relative. */
function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : componentFiles(full);
    if (!/\.tsx?$/.test(name)) return [];
    if (name === "index.ts" || /\.(test|spec)\.tsx?$/.test(name) || name.includes(".generated."))
      return [];
    return [path.relative(repoRoot, full).split(path.sep).join("/")];
  });
}

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

const PINNED_SOURCES: Record<string, (key: string) => unknown> = {
  DEFAULT_TIMER_STYLES: (key) => valueAt(DEFAULT_TIMER_STYLES, key),
  DEFAULT_TASK_STYLES: (key) => valueAt(DEFAULT_TASK_STYLES, key),
  "lib/overlay-view.ts": (key) => (overlayView as Record<string, unknown>)[key],
};

describe("design-system component spec catalog", () => {
  it("finds the specs and the components", () => {
    expect(specs.length).toBeGreaterThan(40);
    expect(componentFiles(componentsDir).length).toBeGreaterThan(40);
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
    const missing = componentFiles(componentsDir).filter((file) => !bySource.has(file));
    expect(missing, "components without a spec").toEqual([]);
    const shared = [...bySource].filter(([, files]) => files.length > 1);
    expect(shared, "sources claimed by more than one spec").toEqual([]);
  });

  it("lists every spec in the catalog README and the docs page", () => {
    const readme = read(path.join(specDir, "README.md"));
    const docs = read(path.join(repoRoot, "apps/fumadocs/content/docs/design-system.mdx"));
    for (const spec of specs) {
      expect(readme, `README links ${spec.file}`).toContain(`(./${spec.file})`);
      expect(docs, `design-system.mdx lists ${spec.file}`).toContain(`\`${spec.file}\``);
    }
  });

  it.each([
    [
      "timer-ring.md",
      [
        "dimensions.width",
        "dimensions.height",
        "background.borderRadius",
        "ring.width",
        "ring.gap",
        "ring.trackOpacity",
        "fontSizes.label",
        "fontSizes.time",
        "fontSizes.cycle",
        "TIMER_CYCLE_OPACITY",
      ],
    ],
    [
      "task-card.md",
      [
        "header.height",
        "header.fontSize",
        "task.fontSize",
        "task.border.radius",
        "ACTIVE_ROW_TINT_PERCENT",
        "AUTHOR_HEADER_TINT_PERCENT",
        "MORE_FOOTER_OPACITY",
        "TASK_ROW_GAP_PX",
      ],
    ],
  ])("%s quotes the renderer's real defaults", (file, required) => {
    const rows = pinnedRows(read(path.join(specDir, file)));
    for (const key of required) expect([...rows.keys()], `${file} pins ${key}`).toContain(key);
    for (const [key, { source, value }] of rows) {
      const lookup = PINNED_SOURCES[source];
      expect(lookup, `${file}: unknown source ${source}`).toBeDefined();
      const actual = lookup?.(key);
      expect(actual, `${file}: ${source} has no ${key}`).toBeDefined();
      expect(value, `${file}: ${key}`).toBe(String(actual));
    }
  });
});
