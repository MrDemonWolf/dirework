import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level contract for the motion system in index.css: every keyframe is
// actually used, reduced-motion still neutralises everything, and popups use
// Base UI's starting/ending-style transitions rather than tw-animate's
// `animate-in` run.
const srcDir = path.join(__dirname, "../..");
// console-rise and the console easing come from the generated token stylesheet; the
// motion-specific keyframes stay in index.css. The contract covers both files.
const css = [
  readFileSync(path.join(srcDir, "index.css"), "utf8"),
  readFileSync(path.join(srcDir, "tokens.generated.css"), "utf8"),
].join("\n");

const componentsDir = path.join(srcDir, "components");
const componentSources = (readdirSync(componentsDir, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => ({ file, source: readFileSync(path.join(componentsDir, file), "utf8") }));
const allComponents = componentSources.map(({ source }) => source).join("\n");

const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);

describe("motion system", () => {
  it("finds the keyframes it is meant to guard", () => {
    expect(keyframes).toEqual(
      expect.arrayContaining(["console-rise", "row-enter", "chip-swap", "led-pulse"]),
    );
  });

  it.each(keyframes)("references @keyframes %s from an animation", (name) => {
    const inCss = new RegExp(`animation:[^;]*\\b${name}\\b`).test(css);
    const inComponents = new RegExp(`animate-\\[${name}[_\\]]`).test(allComponents);
    expect(inCss || inComponents).toBe(true);
  });

  it("keeps the global reduced-motion gate", () => {
    const gate = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/);
    expect(gate?.[0]).toContain("animation-duration: 0.01ms !important");
    expect(gate?.[0]).toContain("transition-duration: 0.01ms !important");
  });

  it("declares the new state animations only for viewers who allow motion", () => {
    const block = css.match(/@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?\n\}/);
    for (const cls of [".row-enter", ".chip-swap", ".save-bar-enter"]) {
      expect(block?.[0]).toContain(cls);
    }
  });

  it("defines the motion tokens", () => {
    for (const token of [
      "--motion-fast:",
      "--motion-base:",
      "--motion-ease:",
      "--motion-ease-emphasized:",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("has no popup left on the old animate-in / duration-100 run", () => {
    const offenders = componentSources
      .filter(({ source }) => /\banimate-in\b|\bduration-100\b/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("transitions popup scale through the `scale` property Tailwind v4 sets", () => {
    for (const file of ["ui/dropdown-menu.tsx", "ui/select.tsx", "ui/tooltip.tsx"]) {
      const source = readFileSync(path.join(componentsDir, file), "utf8");
      expect(source).toContain("transition-[opacity,scale]");
      expect(source).toContain("data-starting-style:opacity-0");
    }
  });
});
