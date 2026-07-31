import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const nextConfig = readFileSync(path.join(__dirname, "../../../next.config.ts"), "utf8");
const overlayLayout = readFileSync(path.join(__dirname, "../../app/(overlay)/layout.tsx"), "utf8");

describe("web security header contract", () => {
  it("enforces CSP without unsafe-eval or a report-only placeholder", () => {
    expect(nextConfig).toContain('{ key: "Content-Security-Policy", value: cspDirectives }');
    expect(nextConfig).not.toContain("Content-Security-Policy-Report-Only");
    expect(nextConfig).not.toContain("unsafe-eval");
    expect(nextConfig).toContain("poweredByHeader: false");
  });

  it("marks bearer-token routes no-store, no-referrer, and no-index", () => {
    expect(nextConfig).toContain('source: "/overlay/:path*"');
    expect(nextConfig).toContain('source: "/bot/:path*"');
    expect(nextConfig).toContain("private, no-store, max-age=0, must-revalidate");
    expect(nextConfig).toContain('{ key: "Referrer-Policy", value: "no-referrer" }');
    expect(nextConfig).toContain("noindex, nofollow, noarchive");
  });

  it("does not load third-party fonts on overlay pages", () => {
    expect(overlayLayout).not.toContain("fonts.googleapis.com");
    expect(overlayLayout).not.toContain("<link");
  });
});
