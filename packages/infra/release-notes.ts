/**
 * Release notes for a tag, straight from CHANGELOG.md: prints the `## [X.Y.Z]` section
 * that matches the tag (`vX.Y.Z`) and refuses to run when apps/web/package.json carries a
 * different version, so a tag can never publish notes for code that doesn't claim them.
 * node:fs only — release.yml runs it before any install.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** `v2.0.0` → `2.0.0`; anything else (no `v`, pre-release, branch name) → null. */
export function versionFromTag(tag: string): string | null {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag.trim());
  return match?.[1] ?? null;
}

/**
 * The body of the `## [version]` section: every line after its heading up to the next
 * `## ` heading, trimmed. Null when the changelog has no such section.
 */
export function extractReleaseNotes(changelog: string, version: string): string | null {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return body.length > 0 ? body : null;
}

/** True when the package manifest's `version` equals `version`. */
export function packageVersionMatches(packageJson: string, version: string): boolean {
  const parsed = JSON.parse(packageJson) as { version?: unknown };
  return parsed.version === version;
}

function main(tag: string | undefined): number {
  const version = tag ? versionFromTag(tag) : null;
  if (!version) {
    console.error(`release-notes: expected a tag like v2.0.0, got ${JSON.stringify(tag)}`);
    return 1;
  }
  const root = resolve(import.meta.dirname, "../..");
  const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
  const webPackage = readFileSync(resolve(root, "apps/web/package.json"), "utf8");
  if (!packageVersionMatches(webPackage, version)) {
    console.error(
      `release-notes: apps/web/package.json is not at ${version}; bump it in the same commit the tag points at.`,
    );
    return 1;
  }
  const notes = extractReleaseNotes(changelog, version);
  if (!notes) {
    console.error(`release-notes: CHANGELOG.md has no "## [${version}]" section.`);
    return 1;
  }
  process.stdout.write(`${notes}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv[2]));
}
