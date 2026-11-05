import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as buttonModule from "@/components/ui/button";

// Source-level contract for the shared link and focus recipes in ui/button.tsx: they are
// class strings, so the regression is a file that types its own prose-link look or its own
// `focus-visible:ring-2` triplet again (the copies had drifted to `ring-1` and to a second
// link look before these recipes existed).
const srcDir = path.join(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(srcDir, rel), "utf8");

const { focusRing, linkVariants } = buttonModule as unknown as {
  focusRing?: string;
  linkVariants?: (props?: { variant?: "prose" | "proseOnTint" | "quiet" }) => string;
};

/** Every `.tsx` module under src/ outside ui/, relative to it, with its source. */
const callSites = (readdirSync(srcDir, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".tsx") && !file.split(path.sep).includes("__tests__"))
  .map((file) => file.split(path.sep).join("/"))
  .filter((file) => !file.startsWith("components/ui/"))
  .map((file) => ({ file, source: read(file) }));

const PROSE_SITES = [
  ["app/(app)/dashboard/bot/(sections)/commands/commands-page.tsx", "prose"],
  // Inside the info Callout's muted/40 tint: foreground stays AAA there.
  ["app/(app)/dashboard/bot/(sections)/replies/replies-page.tsx", "proseOnTint"],
  ["app/(app)/setup/setup-content.tsx", "prose"],
  ["app/(app)/sign-in-notice.tsx", "proseOnTint"],
  ["app/(bot)/bot/[token]/dashboard-bot-link.tsx", "proseOnTint"],
  // "Manage" sits on the card (prose); "Reconnect the bot" in the destructive Callout.
  ["components/bot-settings/bot-live-controls.tsx", "prose"],
  ["components/bot-settings/bot-live-controls.tsx", "proseOnTint"],
  ["components/setup-checklist.tsx", "prose"],
] as const;

/** Hand-rolled controls that must take their ring from `focusRing`. */
const RING_SITES = [
  "components/bot-settings/bot-live-controls.tsx",
  "components/header.tsx",
  "components/version-badge.tsx",
] as const;

const importsFromButton = (source: string, name: string) =>
  new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from "@/components/ui/button"`).test(source);

describe("link and focus recipes", () => {
  it("exports one focus ring: ring-2 in --ring, no outline", () => {
    expect(focusRing?.split(" ").sort()).toEqual(
      ["focus-visible:outline-none", "focus-visible:ring-2", "focus-visible:ring-ring"].sort(),
    );
  });

  it("prose links are link-blue text, always underlined, with the focus ring", () => {
    const classes = linkVariants?.({ variant: "prose" }).split(" ") ?? [];
    // text-link is the AAA text blue; text-primary is the fill and fails as text (AGENTS.md).
    for (const cls of ["text-link", "underline", "font-medium", ...(focusRing?.split(" ") ?? [])])
      expect(classes).toContain(cls);
    expect(classes).not.toContain("text-primary");
  });

  it("links on a tint keep foreground text (AAA there), underlined, with the focus ring", () => {
    // text-link on the destructive Callout's /10 tint is only AA in light mode (6.27:1);
    // foreground stays AAA (tokens-contrast.test.ts measures both rows).
    const classes = linkVariants?.({ variant: "proseOnTint" }).split(" ") ?? [];
    for (const cls of ["text-foreground", "underline", ...(focusRing?.split(" ") ?? [])])
      expect(classes).toContain(cls);
    expect(classes).not.toContain("text-link");
  });

  it("quiet links follow the Footer Convention: no underline, font-medium, hover highlight", () => {
    const classes = linkVariants?.({ variant: "quiet" }).split(" ") ?? [];
    for (const cls of ["font-medium", "hover:text-foreground", ...(focusRing?.split(" ") ?? [])])
      expect(classes).toContain(cls);
    expect(classes).not.toContain("underline");
  });

  it.each(PROSE_SITES)("%s styles its links with linkVariants (%s)", (file, variant) => {
    const source = read(file);
    expect(importsFromButton(source, "linkVariants")).toBe(true);
    expect(source).toContain(`linkVariants({ variant: "${variant}" })`);
    expect(source).not.toMatch(/\bconst inlineLink\b/);
  });

  it("the (app) footer links use the quiet variant, not their own class strings", () => {
    const layout = read("app/(app)/layout.tsx");
    expect(importsFromButton(layout, "linkVariants")).toBe(true);
    expect(layout.match(/linkVariants\(\{ variant: "quiet" \}\)/g)?.length).toBe(4);
    expect(layout).not.toContain("focus-visible:ring-2");
  });

  it.each(RING_SITES)("%s takes its focus ring from focusRing", (file) => {
    const source = read(file);
    expect(
      importsFromButton(source, "focusRing") || importsFromButton(source, "linkVariants"),
    ).toBe(true);
  });

  it("no prose-link class string outside ui/", () => {
    const offenders = callSites
      .filter(({ source }) => /text-link underline-offset-4|const inlineLink\b/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("no hand-written focus ring outside ui/", () => {
    const offenders = callSites
      .filter(({ source }) => /focus-visible:ring-[12]\b/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
