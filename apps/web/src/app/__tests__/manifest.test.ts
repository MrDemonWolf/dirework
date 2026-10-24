import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest, { DARK_BACKGROUND_HEX, LIGHT_BACKGROUND_HEX } from "../manifest";

const webDir = path.resolve(__dirname, "../../..");

/** Width and height from a PNG's IHDR chunk (bytes 16-23, big-endian). */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buf.toString("ascii", 12, 16)).toBe("IHDR");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** PNG colour type 2 (RGB) or 0 (grey) has no alpha channel: an opaque image. */
function pngHasNoAlpha(file: string): boolean {
  const colorType = readFileSync(file)[25];
  return colorType === 0 || colorType === 2;
}

describe("web app manifest", () => {
  const m = manifest();

  it("opens the dashboard as a standalone app scoped to the whole origin", () => {
    expect(m.name).toBe("DireWork");
    expect(m.short_name).toBe("DireWork");
    expect(m.start_url).toBe("/dashboard");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("uses the dark theme background as hex", () => {
    expect(DARK_BACKGROUND_HEX).toBe("#0c0c0e");
    expect(LIGHT_BACKGROUND_HEX).toBe("#fafafa");
    expect(m.background_color).toBe(DARK_BACKGROUND_HEX);
    expect(m.theme_color).toBe(DARK_BACKGROUND_HEX);
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
    const apple = path.join(webDir, "src/app/apple-icon.png");
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
