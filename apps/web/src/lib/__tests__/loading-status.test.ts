import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const components = path.resolve(import.meta.dirname, "../../components");
const read = (file: string) => readFileSync(path.join(components, file), "utf8");

describe("loading status", () => {
  it.each([
    ["dashboard-skeleton.tsx", "dashboard"],
    ["styles-skeleton.tsx", "Theme Center"],
    ["bot-settings-skeleton.tsx", "Bot settings"],
  ])("announces the %s page skeleton", (file, label) => {
    const source = read(file);
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain(`<LoadingStatus label="${label}" />`);
  });

  it("uses a screen-reader-only status role", () => {
    const source = read("loading-status.tsx");
    expect(source).toContain('className="sr-only"');
    expect(source).toContain('role="status"');
  });
});
