import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  path.resolve(import.meta.dirname, "../../../.github/workflows/uptime.yml"),
  "utf8",
);
const probe = workflow.match(/ {8}run: \|\n([\s\S]*?)\n {6}- name: Open, update or close/)?.[1];
if (!probe) throw new Error("Uptime probe shell not found");
const script = probe.replace(/^ {10}/gm, "");

describe("uptime response contracts", () => {
  it.each([
    ["healthy", ""],
    ["missing-limiter", "https://api.test/ready"],
    ["database-down", "https://api.test/ready"],
    ["redirect", "https://web.test/api/version"],
    ["html", "https://web.test/api/version"],
    ["bad-sha", "https://web.test/api/version"],
    ["null-sha", "https://web.test/api/version"],
    ["transport", "https://api.test/ready, https://web.test/api/version"],
  ])("classifies %s without emitting response bodies", (scenario, failed) => {
    const directory = mkdtempSync(path.join(tmpdir(), "dirework-uptime-test-"));
    try {
      // Only curl is replaced: execute the workflow's actual shell and real jq, never gh.
      writeFileSync(
        path.join(directory, "curl"),
        `#!/bin/bash
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    *) url="$1"; shift ;;
  esac
done
status=200
body='{"sha":"fd68fd3"}'
if [[ "$url" == */ready ]]; then
  body='{"status":"ready","db":"ok","limits":"ok"}'
  case "$SCENARIO" in
    missing-limiter) body='{"status":"ready","db":"ok","limits":"missing:RL_AUTH"}' ;;
    database-down) status=503; body='{"status":"degraded","db":"unreachable","limits":"ok"}' ;;
  esac
else
  case "$SCENARIO" in
    redirect) status=302 ;;
    html) body='<html>private response fixture</html>' ;;
    bad-sha) body='{"sha":"NOT-A-COMMIT"}' ;;
    null-sha) body='{"sha":null}' ;;
  esac
fi
printf '%s' "$body" > "$output"
printf '%s' "$status"
[ "$SCENARIO" != transport ]
`,
        { mode: 0o755 },
      );
      const output = path.join(directory, "output");
      const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
        encoding: "utf8",
        timeout: 5000,
        env: {
          PATH: `${directory}:/usr/bin:/bin`,
          TMPDIR: directory,
          API_URL: "https://api.test/",
          WEB_URL: "https://web.test/",
          GITHUB_OUTPUT: output,
          SCENARIO: scenario,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(`failed=${failed}\n`);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(readdirSync(directory).sort()).toEqual(["curl", "output"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
