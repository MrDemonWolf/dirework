import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND, DEMO_SESSION, cycleLabel, formatClock } from "../index";
import { SHARE_CARD_ALT, SHARE_CARD_SIZE, ShareCard } from "../share-card";

const packageDir = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(packageDir, "../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

/** A rendered element as Satori reads it: a `type` and its `props`, nothing React-specific. */
interface CardElement {
  type: unknown;
  props: { children?: unknown; style?: Record<string, unknown> } & Record<string, unknown>;
}

const isElement = (node: unknown): node is CardElement =>
  typeof node === "object" && node !== null && "type" in node && "props" in node;

/** Every element under `node`, depth first. */
function elementsIn(node: unknown): CardElement[] {
  if (Array.isArray(node)) return node.flatMap(elementsIn);
  return isElement(node) ? [node, ...elementsIn(node.props.children)] : [];
}

/** The text the card paints, in reading order. */
function textIn(node: unknown): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textIn);
  return isElement(node) ? textIn(node.props.children) : [];
}

/** The children Satori lays out: null, undefined and booleans draw nothing. */
function childNodes(children: unknown): unknown[] {
  if (Array.isArray(children)) return children.flatMap(childNodes);
  return children === null || children === undefined || typeof children === "boolean"
    ? []
    : [children];
}

describe("ShareCard", () => {
  const card = ShareCard();
  const elements = elementsIn(card);

  it("is the 1200×630 Open Graph card, described by the brand title", () => {
    expect(SHARE_CARD_SIZE).toEqual({ width: 1200, height: 630 });
    expect(SHARE_CARD_ALT).toBe(BRAND.title);
  });

  it("paints the brand copy and the demo session's timer", () => {
    expect(textIn(card)).toEqual([
      BRAND.name,
      `${BRAND.tagline}.`,
      BRAND.description,
      DEMO_SESSION.phaseLabel.toUpperCase(),
      formatClock(DEMO_SESSION.remainingMs),
      cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total),
      "Open source",
      "·",
      "Self-hosted on Cloudflare",
      "·",
      "Made for Twitch",
    ]);
  });

  // next/og (Satori) throws on a div with several children and no explicit display, which
  // would fail both apps' builds; it can't read CSS variables, and it paints an SVG <title>
  // as text over the mark.
  it("stays inside what Satori can draw", () => {
    const undeclared = elements.filter(
      (element) =>
        element.type === "div" &&
        childNodes(element.props.children).length > 1 &&
        !["flex", "none", "contents"].includes(String(element.props.style?.display)),
    );
    expect(undeclared).toEqual([]);
    const values = elements.flatMap((element) => [
      ...Object.values(element.props),
      ...Object.values(element.props.style ?? {}),
    ]);
    expect(values.filter((value) => String(value).includes("var("))).toEqual([]);
    expect(elements.filter((element) => element.type === "title")).toEqual([]);
  });
});

describe("@dirework/overlay-kit entry points", () => {
  const pkg = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8")) as {
    exports: Record<string, unknown>;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  it("serves the card only from the ./share-card subpath, with react as a peer", () => {
    expect(pkg.exports).toEqual({
      ".": { default: "./src/index.ts" },
      "./share-card": { default: "./src/share-card.tsx" },
    });
    expect(pkg.dependencies).toBeUndefined();
    expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(["react"]);
  });

  it("keeps the '.' entry import-free, so importing it never needs React", () => {
    const index = readFileSync(path.join(packageDir, "src/index.ts"), "utf8");
    expect(index).not.toMatch(/\bfrom\s*["']/);
    expect(index).not.toMatch(/\b(import|require)\s*\(|^\s*import\s*["']/m);
  });
});

describe("the apps' opengraph-image routes", () => {
  it.each(["apps/web/src/app/opengraph-image.tsx", "apps/fumadocs/src/app/opengraph-image.tsx"])(
    "%s renders this card, not a copy of it",
    (file) => {
      const source = read(file);
      expect(source).toContain('from "@dirework/overlay-kit/share-card"');
      expect(source).toContain("export const alt = SHARE_CARD_ALT;");
      expect(source).toContain("export const size = SHARE_CARD_SIZE;");
      expect(source).toContain("<ShareCard />");
      // Markup of its own would be a second card to keep in step with this one.
      expect(source).not.toMatch(/<(div|svg)\b/);
    },
  );
});
