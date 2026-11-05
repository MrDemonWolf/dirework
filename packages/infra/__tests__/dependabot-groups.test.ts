import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dependabotYml = readFileSync(
  resolve(import.meta.dirname, "../../../.github/dependabot.yml"),
  "utf8",
);

/**
 * Packages that one Dependabot pull request must carry together.
 * @opennextjs/cloudflare raises its peer floors for next (1.20.16 needs
 * >=16.4.5) and wrangler as it goes, so a lone bump can leave main on an
 * untested pair: Next 16.4 under OpenNext 1.20.9 threw on every request.
 */
const LOCKSTEP = ["next", "@opennextjs/cloudflare", "wrangler"];

/**
 * The group keys `claimants` models. The others (`update-types`,
 * `dependency-type`, `applies-to`, `group-by`) narrow what a group takes, so
 * `readGroups` rejects them until the model learns them.
 */
const MODELED_KEYS = ["patterns", "exclude-patterns"];

type Groups = Map<string, Map<string, string[]>>;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The lines indented under `lines[at]`. */
function blockUnder(lines: string[], at: number): string[] {
  if (at === -1) return [];
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((line) => indentOf(line) <= indentOf(lines[at] ?? ""));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * One ecosystem's `groups`, in file order. packages/infra has no YAML parser,
 * so this reads the block style dependabot.yml uses and throws on any other
 * line: a reformat or a new group filter fails here instead of being misread.
 */
function readGroups(yaml: string, ecosystem: string): Groups {
  const lines = yaml.split("\n").filter((line) => !/^\s*(?:#.*)?$/.test(line));
  const entry = blockUnder(
    lines,
    lines.findIndex((line) => line.trim() === `- package-ecosystem: ${ecosystem}`),
  );
  const block = blockUnder(
    entry,
    entry.findIndex((line) => line.trim() === "groups:"),
  );
  const groups: Groups = new Map();
  let rules: Map<string, string[]> | undefined;
  let values: string[] | undefined;
  for (const line of block) {
    const text = line.trim();
    const [, key] = /^([\w.-]+):(?:\s+#.*)?$/.exec(text) ?? [];
    const item = /^-\s+(?:"([^"]*)"|'([^']*)'|([^\s"'#]+))(?:\s+#.*)?$/.exec(text);
    if (key && indentOf(line) === indentOf(block[0] ?? "")) {
      rules = new Map();
      values = undefined;
      groups.set(key, rules);
    } else if (key && rules && MODELED_KEYS.includes(key)) {
      values = [];
      rules.set(key, values);
    } else if (item && values) {
      values.push(item[1] ?? item[2] ?? item[3] ?? "");
    } else {
      throw new Error(`dependabot-groups.test.ts cannot read or model "${text}"`);
    }
  }
  if (groups.size === 0) throw new Error(`dependabot.yml has no ${ecosystem} groups`);
  return groups;
}

/** Dependabot's WildcardMatcher: `*` spans any run, and the whole name must match, in any case. */
function matches(pattern: string, name: string): boolean {
  const literals = pattern
    .toLowerCase()
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${literals.join(".*")}$`).test(name.toLowerCase());
}

/**
 * The groups that take `name` (dependabot-core's DependencyGroup#contains?): no
 * exclude-pattern matches it, and a pattern does or the group sets none.
 */
function claimants(groups: Groups, name: string): string[] {
  return [...groups]
    .filter(([, rules]) => {
      const patterns = rules.get("patterns");
      const excluded = rules.get("exclude-patterns")?.some((pattern) => matches(pattern, name));
      return !excluded && (!patterns || patterns.some((pattern) => matches(pattern, name)));
    })
    .map(([group]) => group);
}

describe("Dependabot bun groups", () => {
  const groups = readGroups(dependabotYml, "bun");

  // Dependabot's docs say a package that several groups match goes to the
  // first one; its engine ranks them by pattern specificity instead. A single
  // claimant is the one layout both readings agree on, so that is what this pins.
  it("gives next, @opennextjs/cloudflare and wrangler to one group and no other", () => {
    const [owner] = claimants(groups, "@opennextjs/cloudflare");
    expect(Object.fromEntries(LOCKSTEP.map((name) => [name, claimants(groups, name)]))).toEqual(
      Object.fromEntries(LOCKSTEP.map((name) => [name, [owner]])),
    );
  });

  it.each<[string, string, boolean]>([
    ["@opennextjs/*", "@opennextjs/cloudflare", true],
    ["next", "next-themes", false],
    ["react", "react-dom", false],
    ["@TRPC/*", "@trpc/server", true],
  ])("matches pattern %s against %s as Dependabot does (%s)", (pattern, name, expected) => {
    expect(matches(pattern, name)).toBe(expected);
  });
});
