import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  type DesignTokens,
  OUTPUTS,
  rem,
  renderAll,
  TAILWIND_TEXT_STEPS,
} from "../../../../../design-system/scripts/render";

/**
 * design-system/tokens.json generates the token CSS for the app and the docs
 * (design-system/scripts/render.ts). These checks keep the committed files, the
 * two schemes and the reference type scale honest.
 */

const ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const tokens = JSON.parse(
  readFileSync(join(ROOT, "design-system/tokens.json"), "utf8"),
) as DesignTokens;
const rendered = renderAll(tokens);

describe("design tokens", () => {
  it.each([OUTPUTS.web, OUTPUTS.docs])("%s matches tokens.json", (path) => {
    const committed = readFileSync(join(ROOT, path), "utf8");
    expect(committed, `${path} is stale — run \`bun run tokens\``).toBe(rendered[path]);
  });

  it("defines the same keys in the light and dark schemes", () => {
    const { light, dark } = tokens.color.scheme;
    expect(Object.keys(dark)).toEqual(Object.keys(light));
  });

  it("keeps hex out of the theme palette (phase, partner, brand and OBS only)", () => {
    // color-obs-*: the bot dock copies OBS Studio's Yami palette, which OBS defines in hex.
    const allowed =
      /^\s*--(phase-[a-z-]+|twitch|twitch-hover|color-twitch|color-twitch-hover|brand-[a-z0-9-]+|color-obs-[a-z-]+):/;
    for (const path of [OUTPUTS.web, OUTPUTS.docs]) {
      const css = rendered[path] ?? "";
      const hexLines = css.split("\n").filter((line) => line.includes("#"));
      expect(hexLines.length).toBeGreaterThan(0);
      for (const line of hexLines) expect(line).toMatch(allowed);
    }
  });

  it("lists Tailwind's own type steps at Tailwind's values", () => {
    const require = createRequire(import.meta.url);
    const themeCss = readFileSync(
      join(dirname(require.resolve("tailwindcss/package.json")), "theme.css"),
      "utf8",
    );
    const tailwind = new Map(
      [...themeCss.matchAll(/--text-([a-z0-9]+):\s*([\d.]+rem);/g)].map((m) => [m[1], m[2]]),
    );
    for (const step of TAILWIND_TEXT_STEPS) {
      const px = tokens.font.size[step];
      expect(px, `font.size.${step} missing from tokens.json`).toBeDefined();
      expect(rem(px ?? 0), `font.size.${step}`).toBe(tailwind.get(step));
    }
  });

  it("emits the radius scale only for the app", () => {
    expect(rendered[OUTPUTS.web]).toContain("--radius-lg: var(--radius);");
    expect(rendered[OUTPUTS.docs]).not.toMatch(/--radius/);
  });

  it("never colours docs text with the dark accent fill", () => {
    // --brand-500 is the button-fill blue (below 4.5:1 as text on the dark page and muted
    // surface); --brand-600 is the text blue and already flips with the theme, so a `.dark`
    // override that sets text to --brand-500 regresses contrast.
    const docsCss = readFileSync(join(ROOT, "apps/fumadocs/src/app/global.css"), "utf8");
    const darkTextOnFill = docsCss.match(
      /\.dark [^{]*\{[^}]*(?<![-\w])color:\s*var\(--brand-500\)[^}]*\}/g,
    );
    expect(darkTextOnFill).toBeNull();
    // A selector list cut short (a trailing comma before a blank line) glues itself onto
    // the next rule.
    expect(docsCss).not.toMatch(/,[ \t]*\n[ \t]*\n/);
  });
});
