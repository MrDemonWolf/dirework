import { runSmokeCheck } from "./smoke";

const apiUrl = process.env.DIREWORK_API_URL;
const webUrl = process.env.DIREWORK_WEB_URL;
const expectedSha = process.env.GITHUB_SHA;

if (!apiUrl || !webUrl || !expectedSha) {
  console.error("DIREWORK_API_URL, DIREWORK_WEB_URL and GITHUB_SHA are required.");
  process.exit(1);
}

const errors = await runSmokeCheck({ apiUrl, webUrl, expectedSha });
if (errors.length > 0) {
  console.error(`Post-deploy smoke check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Post-deploy smoke check passed.");
