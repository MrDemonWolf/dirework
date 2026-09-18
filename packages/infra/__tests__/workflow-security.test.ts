import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const workflowsDirectory = `${repoRoot}/.github/workflows`;

function readWorkflow(name: string): string {
  return readFileSync(`${workflowsDirectory}/${name}`, "utf8");
}

describe("workflow supply-chain controls", () => {
  it("pins every step action to a full commit SHA", () => {
    const workflowNames = readdirSync(workflowsDirectory).filter((name) => name.endsWith(".yml"));
    const actionRefs = workflowNames.flatMap((name) =>
      [...readWorkflow(name).matchAll(/^\s*-\s+uses:\s+([^\s#]+)/gm)].map((match) => match[1]),
    );

    expect(actionRefs.length).toBeGreaterThan(0);
    for (const ref of actionRefs) {
      expect(ref).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
    }
  });

  it("does not expose deploy secrets until after the frozen install", () => {
    const deploy = readWorkflow("deploy.yml");
    const installPosition = deploy.indexOf("bun install --frozen-lockfile");
    const firstSecretPosition = deploy.indexOf("${{ secrets.");

    expect(installPosition).toBeGreaterThan(-1);
    expect(firstSecretPosition).toBeGreaterThan(installPosition);
    expect(deploy.slice(0, installPosition)).not.toContain("${{ secrets.");
  });

  it.each(["verify.yml", "ci.yml", "deploy.yml", "deploy-docs-to-pages.yml", "codeql.yml"])(
    "disables persisted checkout credentials in %s",
    (name) => {
      const workflow = readWorkflow(name);
      expect(workflow).toMatch(
        /actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false/,
      );
    },
  );

  it("bundle-checks the API Worker during the shared production build", () => {
    const serverPackage = JSON.parse(
      readFileSync(`${repoRoot}/apps/server/package.json`, "utf8"),
    ) as { scripts?: { build?: string } };

    expect(serverPackage.scripts?.build).toContain("wrangler deploy");
    expect(serverPackage.scripts?.build).toContain("--dry-run");
  });

  it("runs the extended CodeQL security suite", () => {
    const codeql = readWorkflow("codeql.yml");
    expect(codeql).toContain("languages: javascript-typescript");
    expect(codeql).toContain("queries: security-extended");
  });
});
