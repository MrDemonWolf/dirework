import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SCHEME_HEX } from "@/tokens.generated";

import manifest from "../manifest";

import { pngHasNoAlpha, pngSize } from "./png";

const webDir = path.resolve(__dirname, "../../..");

describe("web app manifest", () => {
  const m = manifest();

  it("serves both site icons as static assets declared in root metadata", () => {
    expect(existsSync(path.join(webDir, "src/app/icon.svg"))).toBe(false);
    expect(existsSync(path.join(webDir, "src/app/apple-icon.png"))).toBe(false);
    expect(existsSync(path.join(webDir, "public/icons/icon.svg"))).toBe(true);
    expect(existsSync(path.join(webDir, "public/icons/apple-icon.png"))).toBe(true);
    const rootLayout = readFileSync(path.join(webDir, "src/app/layout.tsx"), "utf8");
    expect(rootLayout).toContain(
      'icon: { url: "/icons/icon.svg", type: "image/svg+xml", sizes: "any" }',
    );
    expect(rootLayout).toContain('apple: { url: "/icons/apple-icon.png", sizes: "180x180" }');
  });

  it("opens the dashboard as a standalone app scoped to the whole origin", () => {
    expect(m.name).toBe("DireWork");
    expect(m.short_name).toBe("DireWork");
    expect(m.start_url).toBe("/dashboard");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("uses the dark theme background, as the generated hex", () => {
    // design-tokens.test.ts holds tokens.generated.ts to tokens.json.
    expect(m.background_color).toBe(SCHEME_HEX.dark.background);
    expect(m.theme_color).toBe(SCHEME_HEX.dark.background);
  });

  it("ships every icon at the size it declares", () => {
    const icons = m.icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of icons) {
      expect(icon.src).toMatch(/^\/icons\/[\w-]+\.png$/);
      expect(icon.type).toBe("image/png");
      const file = path.join(webDir, "public", icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = (icon.sizes ?? "").split("x").map(Number);
      expect(pngSize(file)).toEqual({ width: w, height: h });
    }
    const sizes = icons.filter((i) => i.purpose !== "maskable").map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("has exactly one maskable icon, and it is opaque", () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
    expect(maskable).toHaveLength(1);
    expect(pngHasNoAlpha(path.join(webDir, "public", maskable[0].src))).toBe(true);
  });

  it("ships an opaque 180x180 apple-touch-icon", () => {
    const apple = path.join(webDir, "public/icons/apple-icon.png");
    expect(pngSize(apple)).toEqual({ width: 180, height: 180 });
    expect(pngHasNoAlpha(apple)).toBe(true);
  });

  it("is linked only from the (app) layout, never from overlays or the bot console", () => {
    const read = (rel: string) => readFileSync(path.join(webDir, "src/app", rel), "utf8");
    expect(read("(app)/layout.tsx")).toContain('manifest: "/manifest.webmanifest"');
    expect(read("layout.tsx")).not.toContain("manifest:");
    expect(read("(overlay)/layout.tsx")).not.toContain("manifest");
  });
});
