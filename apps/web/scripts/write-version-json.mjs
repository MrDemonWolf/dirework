import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let sha = "dev";
try {
  sha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Match next.config.ts when git metadata is unavailable.
}

writeFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/version.json"),
  JSON.stringify({ sha }),
);
