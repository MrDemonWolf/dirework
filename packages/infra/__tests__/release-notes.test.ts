import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { extractReleaseNotes, packageVersionMatches, versionFromTag } from "../release-notes";

const repoRoot = resolve(import.meta.dirname, "../../..");

const sample = `# Changelog

## [Unreleased]

### Added
- not yet

## [2.0.0] - 2026-10-20

### Upgrade notes
- New required secret.

### Fixed
- A thing.

## [1.1.0] - 2026-07-10

### Changed
- Older.
`;

describe("versionFromTag", () => {
  it("accepts vX.Y.Z and nothing else", () => {
    expect(versionFromTag("v2.0.0")).toBe("2.0.0");
    expect(versionFromTag(" v10.4.2\n")).toBe("10.4.2");
    expect(versionFromTag("2.0.0")).toBeNull();
    expect(versionFromTag("v2.0.0-rc.1")).toBeNull();
    expect(versionFromTag("main")).toBeNull();
  });
});

describe("extractReleaseNotes", () => {
  it("returns exactly the requested version's section", () => {
    const notes = extractReleaseNotes(sample, "2.0.0");
    expect(notes).toContain("### Upgrade notes");
    expect(notes).toContain("- A thing.");
    expect(notes).not.toContain("Unreleased");
    expect(notes).not.toContain("Older");
    expect(notes?.startsWith("### Upgrade notes")).toBe(true);
  });

  it("returns null for an unknown version or an empty section", () => {
    expect(extractReleaseNotes(sample, "3.0.0")).toBeNull();
    expect(extractReleaseNotes("## [1.0.0]\n\n## [0.9.0]\n- x\n", "1.0.0")).toBeNull();
  });

  // The real changelog must carry the version the web app claims, or release.yml fails.
  it("finds the current release in the repo's own CHANGELOG.md", () => {
    const changelog = readFileSync(resolve(repoRoot, "CHANGELOG.md"), "utf8");
    const webPackage = readFileSync(resolve(repoRoot, "apps/web/package.json"), "utf8");
    const { version } = JSON.parse(webPackage) as { version: string };
    expect(packageVersionMatches(webPackage, version)).toBe(true);
    expect(extractReleaseNotes(changelog, version)).not.toBeNull();
  });
});

describe("packageVersionMatches", () => {
  it("compares the manifest version exactly", () => {
    expect(packageVersionMatches('{"version":"2.0.0"}', "2.0.0")).toBe(true);
    expect(packageVersionMatches('{"version":"2.0.1"}', "2.0.0")).toBe(false);
    expect(packageVersionMatches("{}", "2.0.0")).toBe(false);
  });
});
