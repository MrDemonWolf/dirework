import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  type DesignTokens,
  OUTPUTS,
  oklchToHex,
  rem,
  renderAll,
  renderConsoleClasses,
  TAILWIND_TEXT_STEPS,
} from "../../../../../design-system/scripts/render";

/**
 * design-system/tokens.json generates the token CSS for the app and the docs, and the
 * app's hex module (design-system/scripts/render.ts). These checks keep the committed
 * files, the two schemes and the reference type scale honest.
 */

const ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const tokens = JSON.parse(
  readFileSync(join(ROOT, "design-system/tokens.json"), "utf8"),
) as DesignTokens;
const rendered = renderAll(tokens);

describe("design tokens", () => {
  it.each([OUTPUTS.web, OUTPUTS.docs, OUTPUTS.webHex, OUTPUTS.shareCardHex])(
    "%s matches tokens.json",
    (path) => {
      const committed = readFileSync(join(ROOT, path), "utf8");
      expect(committed, `${path} is stale — run \`bun run tokens\``).toBe(rendered[path]);
    },
  );

  it("converts oklch tokens to sRGB hex, keeping a translucent token's alpha", () => {
    // The backgrounds design-system/README.md documents, and the dark `--input`.
    expect(oklchToHex("oklch(0.155 0.004 286)")).toBe("#0c0c0e");
    expect(oklchToHex("oklch(0.985 0 0)")).toBe("#fafafa");
    expect(oklchToHex("oklch(0.947 0.003 286 / 20%)")).toBe("#ededef33");
    // Out of gamut (the dark `--link`) clips per channel.
    expect(oklchToHex("oklch(0.75 0.15 256)")).toBe("#6bb0ff");
    expect(() => oklchToHex("{cornflower}")).toThrow(/not an oklch/);
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

  it("keeps the docs hero scene and chip colors on generated tokens", () => {
    const page = readFileSync(join(ROOT, "apps/fumadocs/src/app/(home)/page.tsx"), "utf8");
    const marketing = readFileSync(
      join(ROOT, "apps/fumadocs/src/app/(home)/marketing.css"),
      "utf8",
    );
    const docs = readFileSync(join(ROOT, "apps/fumadocs/src/app/global.css"), "utf8");
    const scene = marketing.slice(
      marketing.indexOf(".marketing-scene {"),
      marketing.indexOf(".marketing-proof-strip {"),
    );

    expect(page).toContain('className="marketing-scene dark"');
    expect(scene).not.toMatch(/#[\da-f]{3,8}\b/i);
    for (const name of ["chip-live-fg", "chip-warn-fg", "chat-user-1", "chat-user-3"]) {
      const values = docs.match(new RegExp(`--${name}:\\s*([^;]+);`, "g"));
      expect(values?.length).toBe(2);
      for (const value of values ?? []) expect(value).toContain("var(--");
    }
  });

  describe("console classes come from one source", () => {
    const CONSOLE_SELECTORS = [
      ".console-label",
      ".console-rule",
      ".console-rule::after",
      ".panel",
      ".dark .panel",
      ".panel-hero",
      ".dark .panel-hero",
      ".panel-inset",
      ".dark .panel-inset",
      ".bg-grain",
    ];
    const handWritten = {
      web: "apps/web/src/index.css",
      docs: "apps/fumadocs/src/app/global.css",
    } as const;

    it.each(["web", "docs"] as const)("the %s token stylesheet defines every rule", (target) => {
      const css = rendered[OUTPUTS[target]] ?? "";
      for (const selector of CONSOLE_SELECTORS) expect(css).toContain(`${selector} {`);
    });

    it.each(["web", "docs"] as const)("%s's own stylesheet no longer copies them", (target) => {
      const css = readFileSync(join(ROOT, handWritten[target]), "utf8");
      for (const selector of CONSOLE_SELECTORS)
        expect(css, `${handWritten[target]} redefines ${selector}`).not.toMatch(
          new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{`, "m"),
        );
    });

    it("both targets share one body: only the edge variable and the radius form differ", () => {
      // The rendered look is unchanged from the hand copies: radius 2xl = 20px = 1.25rem and
      // xl = 16px = 1rem in both; the app edges on --border, the docs on the lighter --hairline.
      const normalise = (lines: string[]) =>
        lines
          .map((l) => l.trim())
          .filter((l) => l && l !== "@layer utilities {")
          .join("\n")
          .replace(/var\(--radius-2xl\)/g, rem(tokens.radius["2xl"]))
          .replace(/var\(--radius-xl\)/g, rem(tokens.radius.xl))
          .replace(/var\(--border\)/g, "var(--hairline)");
      const web = normalise(renderConsoleClasses(tokens, "web"));
      expect(web.endsWith("}\n}")).toBe(true);
      expect(web.slice(0, -2)).toBe(normalise(renderConsoleClasses(tokens, "docs")));
      expect(rem(tokens.radius["2xl"])).toBe("1.25rem");
      expect(rem(tokens.radius.xl)).toBe("1rem");
    });
  });
});
