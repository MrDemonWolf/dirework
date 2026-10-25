import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ratchet against utilities that bypass the design tokens: arbitrary values
 * (`<utility>-[<value>]`: pixel font sizes, em tracking, numeric z-index, hex
 * colors) and the raw Tailwind gray palettes (zinc, slate, gray, neutral,
 * stone). Type, tracking, z-index, widths and colors come from
 * design-system/tokens.json (`text-2xs`, `tracking-label`, `z-(--z-header)`,
 * `max-w-content`, `bg-console-base` …).
 *
 * ALLOWED is the exact set that may stay. The test fails both when a new bypass
 * appears and when an allowed one disappears, so the list can only shrink.
 * Add an entry only for a value no token can express (a one-off layout grid, a
 * component-internal offset) and say why in the group comment.
 *
 * Tailwind scans this file too, so it spells no bypass out literally: a class
 * written here would be compiled into the app's stylesheet.
 */

const SRC = fileURLToPath(new URL("../../", import.meta.url));

const ALLOWED: Record<string, string[]> = {
  // Layout grids and one-off geometry: track lists and calc() offsets, not scale values.
  "app/(app)/layout.tsx": ["grid-rows-[auto_1fr_auto]"],
  // Viewer landing: the static demo scene draws the overlay at fixed geometry (the 22%
  // squircle, 2.6rem demo digits, 13px chat lines) that mirrors the overlay's own values.
  "app/(app)/viewer-landing.tsx": ["grid-cols-[18rem_1fr]"],
  "components/stream-scene.tsx": [
    "grid-cols-[minmax(0,1fr)_20rem]",
    "rounded-[22%]",
    "text-[0.8125rem]",
    "text-[2.6rem]",
    "tracking-[0.08em]",
  ],
  "app/(app)/dashboard/styles/styles-page.tsx": [
    "max-h-[calc(100vh-6rem-var(--save-bar-clearance,0px))]",
  ],
  "app/(app)/dashboard/bot/(sections)/moderation/moderation-page.tsx": [
    "grid-cols-[minmax(0,1fr)_18rem]",
  ],
  "components/theme-center/field-row.tsx": ["grid-cols-[5rem_1fr]", "grid-cols-[6.5rem_1fr]"],
  "components/timer-controls.tsx": ["grid-cols-[6.75rem_4.5rem_auto]", "transition-[width]"],
  "components/mode-toggle.tsx": ["translate-x-[calc(100%-2px)]"],
  "components/user-menu.tsx": ["content-[attr(data-initial)]"],
  // Elevation and LED glows: multi-layer shadows with no shadow token scale.
  "app/(bot)/bot/[token]/bot-console.tsx": [
    "shadow-[0_0_12px_2px_rgba(239,68,68,0.55)]",
    "shadow-[0_0_12px_2px_rgba(251,191,36,0.5)]",
    "shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]",
  ],
  "components/theme-center/theme-card.tsx": ["border-[1.5px]"],
  // shadcn/ui primitives: transition property lists, motion start scale and
  // component-internal geometry, kept as upstream ships them.
  "components/ui/alert-dialog.tsx": [
    "backdrop-blur-[2px]",
    "max-w-[calc(100%-2rem)]",
    "transition-[opacity,scale,translate]",
    "translate-y-[calc(-50%+6px)]",
  ],
  "components/ui/card.tsx": ["grid-cols-[1fr_auto]", "grid-rows-[auto_auto]"],
  "components/ui/dropdown-menu.tsx": ["scale-[0.98]", "transition-[opacity,scale]"],
  "components/ui/select.tsx": ["scale-[0.98]", "transition-[opacity,scale]"],
  "components/ui/slider.tsx": ["transition-[color,box-shadow]"],
  "components/ui/switch.tsx": ["h-[18.4px]", "translate-x-[calc(100%-2px)]"],
  "components/ui/tabs.tsx": ["h-[calc(100%-1px)]"],
  "components/ui/tooltip.tsx": ["scale-[0.98]", "transition-[opacity,scale]"],
};

/** An arbitrary value in utility position; variants (data, group-data, has …) are skipped. */
const ARBITRARY = /(?<![\w-])(?:[a-z0-9-]+:)*([a-z][a-z0-9-]*-\[[^\]\s"'`]+\])(?!:|\/[\w-]+:)/g;
/** Raw gray palette classes, with any variant prefix and opacity modifier. */
const PALETTE =
  /(?<![\w-])(?:[a-z0-9-]+:)*([a-z]+-(?:zinc|slate|gray|neutral|stone)-\d{2,3})(?![\w-])/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function scan(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    const hits = new Set<string>();
    // Safe-area insets have no token form: `env(safe-area-inset-*)` is the platform's own
    // value, so those paddings are allowed by rule rather than listed one by one.
    for (const m of text.matchAll(ARBITRARY)) {
      if (m[1] && !m[1].includes("env(safe-area-inset-")) hits.add(m[1]);
    }
    for (const m of text.matchAll(PALETTE)) if (m[1]) hits.add(m[1]);
    if (hits.size > 0) found[relative(SRC, file).split("\\").join("/")] = [...hits].sort();
  }
  return found;
}

function pairs(map: Record<string, string[]>): string[] {
  return Object.entries(map)
    .flatMap(([file, values]) => values.map((v) => `${file} → ${v}`))
    .sort();
}

describe("token bypass ratchet", () => {
  const found = pairs(scan());
  const allowed = pairs(ALLOWED);

  it("finds no arbitrary value or raw palette class outside the allow-list", () => {
    const fresh = found.filter((p) => !allowed.includes(p));
    expect(fresh, "use a design token (design-system/tokens.json) instead").toEqual([]);
  });

  it("has no stale allow-list entries (the list only shrinks)", () => {
    const stale = allowed.filter((p) => !found.includes(p));
    expect(stale, "remove these from ALLOWED in token-bypass.test.ts").toEqual([]);
  });

  it("detects the bypasses it guards against", () => {
    // Assembled at runtime so Tailwind's scanner never sees a whole class.
    const font = ["text", "[11px]"].join("-");
    const z = ["z", "[60]"].join("-");
    const gray = ["bg", "zinc", "950"].join("-");
    const variant = ["data", "[size=sm]"].join("-");
    const named = ["group", "data", "[x]/g:p-2"].join("-");
    const sample = `cn("${font} ${variant}:${z} ${named} hover:${gray}/80")`;
    const hits = [
      ...[...sample.matchAll(ARBITRARY)].map((m) => m[1]),
      ...[...sample.matchAll(PALETTE)].map((m) => m[1]),
    ];
    expect(hits).toEqual([font, z, gray]);
  });
});
