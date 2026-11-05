import { readFileSync } from "node:fs";
import { expect } from "vitest";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const bytes = (png: string | Uint8Array): Buffer =>
  typeof png === "string" ? readFileSync(png) : Buffer.from(png);

/** Width and height from a PNG's IHDR chunk (bytes 16-23, big-endian). A path or the bytes. */
export function pngSize(png: string | Uint8Array): { width: number; height: number } {
  const buf = bytes(png);
  expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(buf.toString("ascii", 12, 16)).toBe("IHDR");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** PNG colour type 2 (RGB) or 0 (grey) has no alpha channel: an opaque image. */
export function pngHasNoAlpha(png: string | Uint8Array): boolean {
  const colorType = bytes(png)[25];
  return colorType === 0 || colorType === 2;
}
