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
  it("pins every action to a full commit SHA, with the version it stands for alongside", () => {
    const workflowNames = readdirSync(workflowsDirectory).filter((name) => name.endsWith(".yml"));
    const actionRefs = workflowNames.flatMap((name) =>
      [...readWorkflow(name).matchAll(/^\s*(?:-\s+)?uses:\s+(.+)$/gm)]
        .map((match) => match[1] ?? "")
        // Local reusable workflows (./.github/workflows/verify.yml) ride on this commit.
        .filter((ref) => !ref.startsWith("./")),
    );

    expect(actionRefs.length).toBeGreaterThan(0);
    for (const ref of actionRefs) {
      // `owner/repo@<sha> # vN[.N.N]`: Dependabot moves the SHA and the comment
      // together, and the comment is what a reviewer reads.
      expect(ref).toMatch(/^[^@\s]+@[0-9a-f]{40} # v\d+(?:\.\d+)*$/);
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

  it.each(["verify.yml", "ci.yml", "deploy.yml", "codeql.yml", "release.yml"])(
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

  it("ignores exactly one audited advisory, nothing broader", () => {
    const rootPackage = JSON.parse(readFileSync(`${repoRoot}/package.json`, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const audit = rootPackage.scripts?.["audit:dependencies"] ?? "";
    // GHSA-5j98-mcp5-4vw2 is the glob CLI's -c/--cmd injection; the build-time
    // glob@10.3.3 (via @node-minify/core) is only used as a library. See AGENTS.md.
    expect([...audit.matchAll(/--ignore=(\S+)/g)].map(([, id]) => id)).toEqual([
      "GHSA-5j98-mcp5-4vw2",
    ]);
    expect(audit).toContain("--audit-level=high");
  });

  it("boots the built web Worker before anything can deploy it", () => {
    const webPackage = JSON.parse(readFileSync(`${repoRoot}/apps/web/package.json`, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const verify = readWorkflow("verify.yml");

    expect(webPackage.scripts?.["smoke:worker"]).toBe("node scripts/smoke-worker.mjs");
    // After the bundle exists, and under the same build gate as the build step.
    expect(verify.indexOf("bun run smoke:worker")).toBeGreaterThan(
      verify.indexOf("bun run build:worker"),
    );
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

  it("scopes the deploy job to the production environment", () => {
    const deploy = readWorkflow("deploy.yml");
    const deployJob = deploy.slice(deploy.indexOf("\n  deploy:"));
    // The job that reads deployment secrets must declare the environment, so
    // secrets moved into it (and its protection rules) apply to every deploy.
    expect(deployJob).toMatch(/^\n {2}deploy:\n(?: {4}[^\n]*\n)*? {4}environment: production\n/);
    expect(deployJob.indexOf("environment: production")).toBeLessThan(
      deployJob.indexOf("${{ secrets."),
    );
  });

  it("keeps Cloudflare invocation logs off so bearer-token URLs are not persisted", () => {
    const program = readFileSync(`${repoRoot}/packages/infra/alchemy.run.ts`, "utf8");
    expect(program).toContain("logs: { enabled: true, invocationLogs: false }");
    expect(program).not.toMatch(/invocationLogs: true/);
    // Both workers share the one observability config.
    expect(program.match(/^\s+observability,$/gm)).toHaveLength(2);
  });

  it("disables automatic traces that retain token-bearing URLs and OAuth codes", () => {
    const program = readFileSync(`${repoRoot}/packages/infra/alchemy.run.ts`, "utf8");
    expect(program).toContain("traces: { enabled: false }");
    expect(program).not.toMatch(/traces:\s*\{\s*enabled: true/);
  });

  it("keeps the default app infrastructure limited to the free-tier architecture", () => {
    const program = readFileSync(`${repoRoot}/packages/infra/alchemy.run.ts`, "utf8");
    const imports = [...program.matchAll(/import\s*\{([^}]+)\}\s*from "alchemy\/cloudflare"/g)]
      .flatMap((match) => match[1]!.split(",").map((name) => name.trim()))
      .sort();
    // New resource types require an explicit budget and policy review.
    expect(imports).toEqual(["D1Database", "Nextjs", "RateLimit", "Worker", "createCloudflareApi"]);
    expect(program.match(/await D1Database\(/g)).toHaveLength(1);
    expect(program.match(/await (?:Worker|Nextjs)\(/g)).toHaveLength(2);
    expect(program).not.toMatch(/\b(?:crons|scheduled|queues|durableObjects)\s*:/);
  });

  it("smoke-checks the live deployment after Alchemy finishes", () => {
    const deploy = readWorkflow("deploy.yml");
    expect(deploy.indexOf("smoke-check.ts")).toBeGreaterThan(deploy.indexOf("alchemy.run.ts"));
  });

  it("runs the browser end-to-end suite in the shared gate, after the web bundle is built", () => {
    const rootPackage = JSON.parse(readFileSync(`${repoRoot}/package.json`, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const verify = readWorkflow("verify.yml");

    expect(rootPackage.scripts?.e2e).toBe("bun run --cwd packages/e2e e2e");
    // The e2e web worker is the bundle build:worker produced, so it must come after it,
    // and after the cheaper smoke check has already caught a bundle that cannot boot.
    expect(verify.indexOf("bun run e2e")).toBeGreaterThan(verify.indexOf("bun run smoke:worker"));
    // Under the build gate (a docs-only run has no bundle to test) and the e2e opt-out.
    expect(verify).toMatch(
      /- name: Browser end-to-end tests\n\s+if: \$\{\{ inputs\.run-build && inputs\.run-e2e \}\}/,
    );
  });

  it("runs the browser suite by default and lets only the deploy workflows skip it", () => {
    const verify = readWorkflow("verify.yml");
    expect(verify).toMatch(/run-e2e:\n(?: {8}[^\n]*\n)+? {8}default: true/);
    // Every e2e step hangs off both gates: no bundle (docs-only) or an explicit opt-out.
    for (const step of ["Install Playwright browser", "Browser end-to-end tests"]) {
      expect(verify).toMatch(
        new RegExp(`- name: ${step}\\n\\s+if: \\$\\{\\{ inputs\\.run-build && inputs\\.run-e2e`),
      );
    }
    expect(verify).toMatch(/if: \$\{\{ failure\(\) && inputs\.run-build && inputs\.run-e2e \}\}/);

    // The PR/push gate takes the default; it must never opt out.
    expect(readWorkflow("ci.yml")).not.toContain("run-e2e");
    // A docs publish ships no worker, so it skips the suite (not the build).
    expect(readWorkflow("deploy-docs-to-pages.yml")).toContain("run-e2e: false");
    // A deploy runs it unless a hotfix dispatch opts out; on a push the input is
    // null, so `!inputs.skip_e2e` is true and the suite gates the deploy.
    const deploy = readWorkflow("deploy.yml");
    expect(deploy).toMatch(/skip_e2e:\n(?: {8}[^\n]*\n)+? {8}default: false/);
    expect(deploy).toMatch(/run-e2e: \$\{\{ !inputs\.skip_e2e \}\}/);
  });

  it("caches the Playwright browser on the lockfile and downloads it only on a miss", () => {
    const verify = readWorkflow("verify.yml");
    const cacheStep = verify.slice(verify.indexOf("uses: actions/cache@"));
    expect(cacheStep).toMatch(/^\s+id: playwright-cache$/m);
    expect(cacheStep).toContain("path: ~/.cache/ms-playwright");
    // bun.lock pins @playwright/test, so a Playwright bump changes the key.
    expect(cacheStep).toMatch(
      /key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ hashFiles\('bun\.lock'\) \}\}/,
    );
    expect(verify).toMatch(
      /- name: Install Playwright browser\n\s+if: \$\{\{ inputs\.run-build && inputs\.run-e2e && steps\.playwright-cache\.outputs\.cache-hit != 'true' \}\}\n\s+run: bun run e2e:install\n/,
    );
    // The cache holds the browser only; a hit still needs its system libraries.
    expect(verify).toMatch(
      /- name: Install Playwright system dependencies\n\s+if: \$\{\{ inputs\.run-build && inputs\.run-e2e && steps\.playwright-cache\.outputs\.cache-hit == 'true' \}\}\n\s+run: bun run e2e:install-deps\n/,
    );

    const rootPackage = JSON.parse(readFileSync(`${repoRoot}/package.json`, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const e2ePackage = JSON.parse(
      readFileSync(`${repoRoot}/packages/e2e/package.json`, "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(rootPackage.scripts?.["e2e:install-deps"]).toBe(
      "bun run --cwd packages/e2e e2e:install-deps",
    );
    expect(e2ePackage.scripts?.["e2e:install-deps"]).toBe("playwright install-deps chromium");
    expect(e2ePackage.scripts?.["e2e:install"]).toContain("--with-deps");
  });

  it("refuses to deploy from any ref but main, before verify runs", () => {
    const deploy = readWorkflow("deploy.yml");
    expect(deploy).toMatch(/\n {2}guard:\n(?: {4}[^\n]*\n)*? {4}timeout-minutes: 2\n/);
    expect(deploy).toContain("if: github.ref != 'refs/heads/main'");
    expect(deploy).toContain(
      "::error title=Deploy refused::Deploy runs only from refs/heads/main (got $GITHUB_REF). Merge to main instead.",
    );
    expect(deploy).toMatch(/Merge to main instead\."\n\s+exit 1\n/);
    // verify (and so deploy) waits on the guard.
    const needsGuard = deploy.indexOf("needs: guard");
    expect(needsGuard).toBeGreaterThan(-1);
    expect(needsGuard).toBeLessThan(deploy.indexOf("uses: ./.github/workflows/verify.yml"));
    expect(deploy).toMatch(/\n {2}verify:\n {4}needs: guard\n/);
  });

  it("checks both Worker bundles against the free-plan budget before the runtime smoke check", () => {
    const verify = readWorkflow("verify.yml");
    const budgetStep = verify.indexOf("- name: Worker bundle budget");
    // After the bundles exist, before the slower boot check spends time on an oversized one.
    expect(budgetStep).toBeGreaterThan(verify.indexOf("bun run build:worker"));
    expect(budgetStep).toBeLessThan(verify.indexOf("bun run smoke:worker"));
    // Same gate as the build steps, run under Node via the lockfile-pinned tsx.
    expect(verify.slice(budgetStep)).toMatch(
      /^- name: Worker bundle budget\n\s+if: \$\{\{ inputs\.run-build \|\| inputs\.upload-docs \}\}\n\s+working-directory: packages\/infra\n\s+run: node \.\/node_modules\/\.bin\/tsx bundle-budget\.ts\n/,
    );
  });

  it("publishes a GitHub Release only from a version tag, with notes taken from the changelog", () => {
    const release = readWorkflow("release.yml");
    // Tags only: a branch push must never mint a release.
    expect(release).toMatch(/on:\n\s+push:\n\s+tags: \["v\*"\]/);
    expect(release).not.toMatch(/branches:/);
    // Least privilege: read at the top, write only on the one job that creates the release.
    expect(release).toMatch(/^permissions:\n\s+contents: read/m);
    expect(release).toMatch(/jobs:\n\s+release:\n(?:.*\n)*?\s+permissions:\n\s+contents: write/);
    // Upstream only, and the tag must exist on GitHub (no release for a local-only tag).
    expect(release).toContain("github.repository == 'mrdemonwolf/dirework'");
    expect(release).toContain('gh release create "$TAG" --verify-tag');
    expect(release).toContain("bun packages/infra/release-notes.ts");
  });

  it("verifies a merge to main once, from deploy.yml, instead of again from ci.yml", () => {
    // A push to main is a merge, and deploy.yml (plus the docs deploy) already runs
    // verify.yml on it, build and e2e included; a push trigger in ci.yml would be a
    // third copy of the same run. Pull requests into main stay gated.
    expect(readWorkflow("ci.yml")).toMatch(
      /^on:\n {2}push:\n(?: {4}#[^\n]*\n)* {4}branches: \[dev\]\n {2}pull_request:\n {4}branches: \[dev, main\]\n/m,
    );
    expect(readWorkflow("deploy.yml")).toMatch(/^on:\n {2}push:\n {4}branches: \[main\]\n/m);
  });
});

describe("uptime probe", () => {
  const uptime = readWorkflow("uptime.yml");

  it("runs every 30 minutes and by hand, on nothing else", () => {
    expect(uptime).toMatch(
      /^on:\n {2}schedule:\n {4}- cron: "\*\/30 \* \* \* \*"\n {2}workflow_dispatch:\n/m,
    );
  });

  it("holds no permission beyond writing the one uptime issue", () => {
    expect(uptime).toMatch(/^permissions: \{\}$/m);
    const grants = [...uptime.matchAll(/^ +permissions:\n((?: {6}[^\n]+\n)+)/gm)].map((match) =>
      (match[1] ?? "").trim(),
    );
    expect(grants).toEqual(["issues: write"]);
    expect(uptime).not.toContain("secrets.");
  });

  it("uses no actions at all: nothing to pin, nothing to check out", () => {
    expect(uptime).not.toMatch(/^\s*-?\s*uses:/m);
    expect(uptime).not.toContain("actions/checkout");
  });

  it("stays dormant until both repository variables are set", () => {
    expect(uptime).toMatch(/^ {4}if: vars\.UPTIME_API_URL != '' && vars\.UPTIME_WEB_URL != ''$/m);
  });

  it("probes readiness on the api worker and the version route on the web worker, bounded", () => {
    // Escaped: the shell expands these, so the test wants them verbatim.
    expect(uptime).toContain(`"\${API_URL%/}/ready"`);
    expect(uptime).toContain(`"\${WEB_URL%/}/api/version"`);
    expect(uptime).toMatch(/curl -fsS --max-time \d+ --retry \d+ --retry-delay \d+/);
  });

  it("keeps one issue per outage: label, create or comment, then close on recovery", () => {
    expect(uptime).toContain("gh label create uptime");
    expect(uptime).toContain("gh issue list --label uptime --state open");
    expect(uptime).toContain(
      'gh issue create --title "Uptime: instance unreachable" --label uptime',
    );
    expect(uptime).toContain("gh issue close");
    // A failed probe fails the run too, so it shows with the other Actions failures.
    expect(uptime).toMatch(/\n {12}exit 1\n/);
  });
});
