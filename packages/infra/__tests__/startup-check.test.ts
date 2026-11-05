import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  STARTUP_FAIL_MS,
  STARTUP_LIMIT_MS,
  apiDryRunArgs,
  parseStartupCpuMs,
  startupFailures,
  startupSummary,
} from "../startup-check";

// The report `wrangler check startup` (4.156) prints to a pipe, from a local run
// over the web Worker.
const REPORT = [
  "│ Startup phase analysed",
  "│",
  "│ Bundle: 6623.48 KiB / gzip: 2116.75 KiB",
  "│",
  "│ Local startup profile:",
  "│   Profile window: 109.4 ms",
  "│   Sampled time: 103.4 ms",
  "│   Active: 40.2 ms (including 1.3 ms garbage collection)",
  "│   Idle: 63.2 ms",
  "│   Samples: 25",
  "│",
  "│ CPU Profile has been written to web.cpuprofile.",
].join("\n");

describe("parseStartupCpuMs", () => {
  it("reads the startup CPU time (active time, idle excluded) out of the report", () => {
    expect(parseStartupCpuMs(REPORT)).toBe(40.2);
  });

  it("reads the report when wrangler colors it", () => {
    expect(parseStartupCpuMs("\u001b[2m│\u001b[22m   Active: 612.5 ms (including 4.0 ms")).toBe(
      612.5,
    );
  });

  it("refuses output without it rather than passing a startup it never measured", () => {
    expect(() =>
      parseStartupCpuMs("✘ [ERROR] Worker startup profiling timed out after 10 seconds."),
    ).toThrow(/startup CPU time/);
  });
});

describe("startupFailures", () => {
  it("fails only above half of Cloudflare's 1 s startup limit", () => {
    expect(STARTUP_LIMIT_MS).toBe(1000);
    expect(STARTUP_FAIL_MS).toBe(STARTUP_LIMIT_MS / 2);

    expect(startupFailures({ api: 86.7, web: 40.2 })).toEqual([]);
    expect(startupFailures({ api: 86.7, web: STARTUP_FAIL_MS })).toEqual([]);
    expect(startupFailures({ api: 86.7, web: 500.1 })).toEqual([
      expect.stringMatching(/^web: 500\.1 ms of startup CPU is over 500 ms/),
    ]);
  });
});

describe("startupSummary", () => {
  it("tables each worker's startup CPU time for the job summary, with the threshold and the limit", () => {
    const summary = startupSummary({ api: 86.7, web: 612.5 });

    expect(summary).toContain("| api | 86.7 ms | ok |");
    expect(summary).toContain("| web | 612.5 ms | over 500 ms |");
    expect(summary).toContain("fails above 500 ms");
    expect(summary).toContain("limit is 1000 ms");
    // Appended to $GITHUB_STEP_SUMMARY, so it must end on its own line.
    expect(summary.endsWith("\n")).toBe(true);
  });
});

describe("apiDryRunArgs", () => {
  it("bundles the api the way the server's build script does, into an upload file", () => {
    const server = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../../../apps/server/package.json"), "utf8"),
    ) as { scripts: { build: string } };

    expect(["wrangler", ...apiDryRunArgs("api.bundle")].join(" ")).toBe(
      server.scripts.build.replace("--outdir dist", "--outfile api.bundle"),
    );
  });
});
