import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

describe("StatusChip recipe", () => {
  it("shares the warning chip classes with the version reload button", () => {
    const chip = read("components/status-chip.tsx");
    const badge = read("components/version-badge.tsx");

    expect(chip).toContain("export function statusChipClassName(");
    expect(chip).toContain("statusChipClassName({ tone, size })");
    expect(badge).toContain('import { statusChipClassName } from "@/components/status-chip"');
    expect(badge).toContain('statusChipClassName({ tone: "warn", size: "sm" })');
    expect(badge).not.toContain("border-warning/30 bg-warning/10");
  });

  it("pins the line box and uses one skeleton for both sizes", () => {
    const chip = read("components/status-chip.tsx");
    const dashboard = read("components/dashboard-skeleton.tsx");
    const bot = read("components/bot-settings-skeleton.tsx");

    expect(chip).toMatch(/text-2xs[^"\n]*leading-4/);
    expect(chip).toContain("export function StatusChipSkeleton(");
    expect(chip).toContain('size === "sm" ? "h-5.5" : "h-6.5"');
    for (const skeleton of [dashboard, bot]) {
      expect(skeleton).toContain('import { StatusChipSkeleton } from "@/components/status-chip"');
      expect(skeleton).not.toContain("function ChipSkeleton(");
    }
  });

  it("renders on the server: no client directive, hooks or handlers", () => {
    // viewer-landing.tsx and stream-scene.tsx are server components; a "use client" here would
    // ship the chip (and cn's tailwind-merge) to / and /setup for markup that never changes.
    const chip = read("components/status-chip.tsx");
    expect(chip).not.toContain('"use client"');
    expect(chip).not.toMatch(/\buse[A-Z]\w*\(/);
    expect(chip).not.toMatch(/\bon[A-Z]\w*=/);
    expect(read("components/ui/skeleton.tsx")).not.toContain('"use client"');
  });
});
