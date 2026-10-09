import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COMPATIBILITY_DATE } from "../deploy-config";

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

  it.each(["verify.yml", "ci.yml", "deploy.yml", "codeql.yml"])(
    "disables persisted checkout credentials in %s",
    (name) => {
      const workflow = readWorkflow(name);
      expect(workflow).toMatch(
        /actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false/,
      );
    },
  );

  it("deploys docs only after the shared verification gate uploads the site", () => {
    const docs = readWorkflow("deploy-docs-to-pages.yml");
    expect(docs).toContain("uses: ./.github/workflows/verify.yml");
    expect(docs).toContain("upload-docs: true");
    expect(docs).toContain("needs: build");
    expect(readWorkflow("verify.yml")).toMatch(/if: \$\{\{ inputs\.upload-docs \}\}/);
  });

  it("publishes the docs site only from the upstream repository, never a fork", () => {
    const docs = readWorkflow("deploy-docs-to-pages.yml");
    expect(docs).toMatch(
      /\n {2}build:\n(?: {4}#[^\n]*\n)* {4}if: github\.repository == 'mrdemonwolf\/dirework'\n/,
    );
  });

  it("runs local deploy and destroy outside turbo so exported shell values reach Alchemy", () => {
    const rootPackage = JSON.parse(readFileSync(`${repoRoot}/package.json`, "utf8")) as {
      scripts?: Record<string, string>;
    };

    for (const script of ["deploy", "destroy"]) {
      expect(rootPackage.scripts?.[script]).toBe(`bun run --cwd packages/infra ${script}`);
    }
  });

  it("bundle-checks the API Worker during the shared production build", () => {
    const serverPackage = JSON.parse(
      readFileSync(`${repoRoot}/apps/server/package.json`, "utf8"),
    ) as { scripts?: { build?: string } };

    expect(serverPackage.scripts?.build).toContain("wrangler deploy");
    expect(serverPackage.scripts?.build).toContain("--dry-run");
  });

  it("bundle-checks and deploys both workers under the one pinned compatibility date", () => {
    const serverPackage = JSON.parse(
      readFileSync(`${repoRoot}/apps/server/package.json`, "utf8"),
    ) as { scripts?: { build?: string } };
    const program = readFileSync(`${repoRoot}/packages/infra/alchemy.run.ts`, "utf8");

    expect(serverPackage.scripts?.build).toContain(`--compatibility-date ${COMPATIBILITY_DATE}`);
    expect(program.match(/compatibilityDate: COMPATIBILITY_DATE,/g)).toHaveLength(2);
  });

  it("builds the deployed web Worker bundle in the shared verification gate", () => {
    const webPackage = JSON.parse(readFileSync(`${repoRoot}/apps/web/package.json`, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const program = readFileSync(`${repoRoot}/packages/infra/alchemy.run.ts`, "utf8");

    expect(webPackage.scripts?.["build:worker"]).toContain("opennextjs-cloudflare build");
    expect(webPackage.scripts?.["build:worker"]).toContain("populateCache local");
    expect(program).toContain("bun run build:worker");
    expect(readWorkflow("verify.yml")).toContain("build:worker");
  });

  it("runs the extended CodeQL security suite over code and workflows", () => {
    const codeql = readWorkflow("codeql.yml");
    expect(codeql).toContain("name: Analyze JavaScript and TypeScript");
    expect(codeql).toContain("languages: javascript-typescript");
    expect(codeql).toContain("languages: actions");
    expect(codeql).toContain("category: /language:actions");
    expect(codeql.match(/queries: security-extended/g)).toHaveLength(2);
  });

  it("bumps the LICENSE year through a pull request, never a push to main", () => {
    const workflow = readWorkflow("update-license-year.yml");
    expect(workflow).toContain("gh pr create --base main");
    expect(workflow).toContain('git push --force -u origin "$BRANCH"');
    expect(workflow.match(/git push/g)).toHaveLength(1);
    expect(workflow).toContain("timeout-minutes:");
  });

  it("blocks PRs on the dependency audit but only warns on deploys", () => {
    const verify = readWorkflow("verify.yml");
    expect(verify).toMatch(/audit-blocking:\n(?: {8}[^\n]*\n)+? {8}default: true/);
    const auditStep = verify.slice(verify.indexOf("- name: Audit dependencies"));
    expect(auditStep).toMatch(/continue-on-error: \$\{\{ !inputs\.audit-blocking \}\}/);
    expect(auditStep).toContain("::warning");

    // The PR/push gate takes the blocking default; it must never opt out.
    expect(readWorkflow("ci.yml")).not.toContain("audit-blocking");
    for (const name of ["deploy.yml", "deploy-docs-to-pages.yml"]) {
      expect(readWorkflow(name)).toContain("audit-blocking: false");
    }
  });

  it("passes every validated deploy secret to both the validation and deploy steps", () => {
    const deploy = readWorkflow("deploy.yml");
    for (const name of ["BETTER_AUTH_SECRET", "PROXY_SECRET"]) {
      expect(
        deploy.match(new RegExp(`${name}: \\$\\{\\{ secrets\\.${name} \\}\\}`, "g")),
      ).toHaveLength(2);
    }
  });

  it("smoke-checks the live deployment after Alchemy finishes", () => {
    const deploy = readWorkflow("deploy.yml");
    expect(deploy.indexOf("smoke-check.ts")).toBeGreaterThan(deploy.indexOf("alchemy.run.ts"));
  });
});
