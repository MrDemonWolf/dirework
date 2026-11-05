import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../..", import.meta.url).pathname;

/**
 * next and the OpenNext adapter move together (AGENTS.md → CI/CD): the adapter
 * supports only the Next releases its `next` peer range names, and the one time
 * the pair drifted (Next 16.4 under OpenNext 1.20.9) every production request
 * threw. Bun only warns on an unmet peer, and Dependabot or a lockfile refresh
 * moves one package at a time, so this holds the pair in bun.lock:
 * - one copy of next, the exact version both apps pin, so the docs' pin can't
 *   keep a second, older Next and a reinstall can't move next under the adapter;
 * - that copy inside the `next` peer range of the resolved adapter and of the
 *   @opennextjs/aws it pins, so a lone adapter bump fails here, not in deploy.
 */
const NEXT_APPS = ["apps/web", "apps/fumadocs"];
const ADAPTERS = ["@opennextjs/cloudflare", "@opennextjs/aws"];

type LockEntry = [
  id: string,
  registry: string,
  meta: { peerDependencies?: Record<string, string> },
  integrity: string,
];

/** A package's root bun.lock entry; Bun writes each one as a single-line JSON array. */
function lockEntry(lock: string, name: string): LockEntry {
  const line = lock.split("\n").find((row) => row.trimStart().startsWith(`"${name}": ["${name}@`));
  if (!line) throw new Error(`${name} has no root entry in bun.lock`);
  return JSON.parse(line.slice(line.indexOf("[")).replace(/,$/, "")) as LockEntry;
}

/** "next@16.4.5" → "16.4.5"; the last "@" also splits scoped names. */
function versionOf([id]: LockEntry): string {
  return id.slice(id.lastIndexOf("@") + 1);
}

function dependencyPin(app: string, name: string): string | undefined {
  const manifest = JSON.parse(readFileSync(`${repoRoot}/${app}/package.json`, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return manifest.dependencies?.[name];
}

function parseVersion(text: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (!match) throw new Error(`unsupported version "${text}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Whether a release version satisfies a range of `||` alternatives, each a list
 * of comparators (`>=15.5.29 <16 || >=16.4.5`): the only shape OpenNext's next
 * peer range has used. A partial bound reads as zero-filled, which is right for
 * `>=` and `<` only. Any other syntax (caret, tilde, x-ranges, a partial `>`,
 * `<=` or `=`) throws, so a new range shape fails this test instead of passing it.
 */
function satisfiesRange(version: string, range: string): boolean {
  const [major, minor, patch] = parseVersion(version);
  return range.split("||").some((alternative) =>
    alternative
      .trim()
      .split(/\s+/)
      .every((comparator) => {
        const match = /^(>=|<=|>|<|=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(comparator);
        if (!match) throw new Error(`unsupported comparator "${comparator}" in "${range}"`);
        const [, op = "=", boundMajor, boundMinor, boundPatch] = match;
        if (boundPatch === undefined && op !== ">=" && op !== "<") {
          throw new Error(`unsupported partial comparator "${comparator}" in "${range}"`);
        }
        const order =
          major - Number(boundMajor) ||
          minor - Number(boundMinor ?? 0) ||
          patch - Number(boundPatch ?? 0);
        if (op === ">=") return order >= 0;
        if (op === ">") return order > 0;
        if (op === "<=") return order <= 0;
        if (op === "<") return order < 0;
        return order === 0;
      }),
  );
}

describe("next and the OpenNext adapter", () => {
  const lock = readFileSync(`${repoRoot}/bun.lock`, "utf8");
  const next = versionOf(lockEntry(lock, "next"));

  it("resolves exactly one copy of next", () => {
    const copies = [...lock.matchAll(/^\s+"(?:[^"]+\/)?next": \["next@([^"]+)"/gm)].map(
      ([, version]) => version,
    );
    expect(copies).toEqual([next]);
  });

  it.each(NEXT_APPS)("%s pins next exactly to that copy", (app) => {
    expect(dependencyPin(app, "next")).toBe(next);
  });

  it("apps/web pins @opennextjs/cloudflare exactly to its resolved version", () => {
    expect(dependencyPin("apps/web", "@opennextjs/cloudflare")).toBe(
      versionOf(lockEntry(lock, "@opennextjs/cloudflare")),
    );
  });

  it.each(ADAPTERS)("keeps next inside %s's next peer range", (name) => {
    const range = lockEntry(lock, name)[2].peerDependencies?.next;
    expect(range, `${name} declares no next peer range`).toBeDefined();
    expect(satisfiesRange(next, range ?? ""), `next@${next} vs ${name} peer "${range}"`).toBe(true);
  });
});

describe("satisfiesRange", () => {
  const OPENNEXT_1_20_16 = ">=15.5.29 <16 || >=16.4.5";

  it("reads OpenNext's two-line peer range", () => {
    expect(satisfiesRange("16.4.5", OPENNEXT_1_20_16)).toBe(true);
    expect(satisfiesRange("16.10.0", OPENNEXT_1_20_16)).toBe(true);
    expect(satisfiesRange("17.0.0", OPENNEXT_1_20_16)).toBe(true);
    expect(satisfiesRange("15.5.29", OPENNEXT_1_20_16)).toBe(true);
    expect(satisfiesRange("16.4.4", OPENNEXT_1_20_16)).toBe(false);
    expect(satisfiesRange("16.4.3", OPENNEXT_1_20_16)).toBe(false);
    expect(satisfiesRange("16.0.0", OPENNEXT_1_20_16)).toBe(false);
    expect(satisfiesRange("15.5.28", OPENNEXT_1_20_16)).toBe(false);
  });

  it("compares each comparator numerically", () => {
    expect(satisfiesRange("1.10.0", ">1.9.9")).toBe(true);
    expect(satisfiesRange("1.2.3", "<=1.2.3")).toBe(true);
    expect(satisfiesRange("1.2.4", "<=1.2.3")).toBe(false);
    expect(satisfiesRange("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesRange("1.2.3", "=1.2.4")).toBe(false);
  });

  it("throws on syntax it can't read rather than guessing", () => {
    expect(() => satisfiesRange("16.4.5", "^16.4.5")).toThrow(/unsupported comparator/);
    expect(() => satisfiesRange("16.4.5", "16.x")).toThrow(/unsupported comparator/);
    expect(() => satisfiesRange("16.4.5", ">16")).toThrow(/unsupported partial/);
    expect(() => satisfiesRange("16.4.5", "<=16.4")).toThrow(/unsupported partial/);
    expect(() => satisfiesRange("16.5.0-canary.1", ">=16.4.5")).toThrow(/unsupported version/);
  });
});
