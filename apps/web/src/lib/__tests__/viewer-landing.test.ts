import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND, DEMO_SESSION, cycleLabel, formatClock } from "@dirework/overlay-kit";

import { StreamScene } from "@/components/stream-scene";
import { taskCommands } from "@/lib/command-rows";
import { DEFAULT_DOCS_URL, landingLinks, REPO_URL } from "@/lib/landing-links";
import { resolveSignInError } from "@/lib/sign-in-errors";
import { ViewerLanding } from "../../app/(app)/viewer-landing";

/**
 * The home page of a claimed instance is only ever seen by non-owners (viewers who followed
 * a link, curious streamers), so it must stay a static page: no queries, no polling, and the
 * owner's sign-in button keeps the accessible name the e2e suite and the sign-out flow use.
 */

const SRC = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(SRC, file), "utf8");

/** Every module the landing route renders that this PR owns. */
const LANDING_FILES = [
  "app/(app)/page.tsx",
  "app/(app)/viewer-landing.tsx",
  "app/(app)/sign-in-notice.tsx",
  "app/(app)/owner-sign-in.tsx",
  "components/stream-scene.tsx",
];

const links = landingLinks(undefined);

function renderLanding(error: string | null = null): string {
  return renderToStaticMarkup(
    createElement(ViewerLanding, {
      links,
      signInError: error ? resolveSignInError(error) : null,
    }),
  );
}

describe("landingLinks", () => {
  it("falls back to the public docs when DOCS_URL is unset or empty", () => {
    expect(landingLinks(undefined).deployGuide).toBe(`${DEFAULT_DOCS_URL}/docs/deployment`);
    expect(landingLinks("  ").docs).toBe(`${DEFAULT_DOCS_URL}/docs`);
  });

  it("builds on the operator's docs origin, without doubling a trailing slash", () => {
    const custom = landingLinks("https://docs.example.com/");
    expect(custom.deployGuide).toBe("https://docs.example.com/docs/deployment");
    expect(custom.docs).toBe("https://docs.example.com/docs");
    expect(custom.releases).toBe(`${REPO_URL}/releases`);
  });
});

describe("stream scene", () => {
  const html = renderToStaticMarkup(createElement(StreamScene));

  it("renders the shared demo session", () => {
    expect(html).toContain(formatClock(DEMO_SESSION.remainingMs));
    expect(html).toContain(cycleLabel(DEMO_SESSION.cycle.current, DEMO_SESSION.cycle.total));
    for (const task of DEMO_SESSION.tasks) {
      expect(html).toContain(task.author);
    }
    for (const line of DEMO_SESSION.chat) {
      // renderToStaticMarkup escapes quotes; compare against the escaped form.
      expect(html).toContain(line.text.replaceAll('"', "&quot;").replaceAll("'", "&#x27;"));
    }
  });

  it("draws the ring partly filled, as mid-block", () => {
    const offsets = [...html.matchAll(/stroke-dashoffset="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(1);
    expect(offsets[0]).toBeGreaterThan(0);
  });
});

describe("viewer landing page", () => {
  it("leads with the brand copy and points at deploying your own", () => {
    const html = renderLanding();
    expect(html).toContain(`<h1 id="landing-title"`);
    expect(html).toContain(`${BRAND.tagline}.`);
    expect(html).toContain(`This channel runs ${BRAND.name}`);
    expect(html).toMatch(new RegExp(`href="${links.deployGuide}"[^>]*>.*?Deploy your own`));
    expect(html).toContain(`href="${links.docs}"`);
    expect(html).toContain("Sign in with Twitch");
  });

  it("lists the viewer commands in the command reference's own words", () => {
    const html = renderLanding();
    for (const name of ["!task", "!done", "!today"]) {
      const row = taskCommands.find((cmd) => cmd.command === name)!;
      expect(html).toContain(row.usage);
      expect(html).toContain(row.description);
    }
  });

  it("shows the claimed-instance notice with a link to the deploy guide", () => {
    const html = renderLanding("instance_claimed");
    expect(html).toContain(resolveSignInError("instance_claimed").title);
    expect(html).toContain(`href="${links.deployGuide}"`);
    expect(html).toContain("Deploy your own →");
    expect(renderLanding()).not.toContain("Deploy your own →");
  });

  it.each(LANDING_FILES)("%s stays static: no queries, polling or tRPC", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/useQuery|useMutation|refetchInterval|setInterval|poll-intervals/);
    expect(source).not.toMatch(/@\/utils\/trpc|lib\/trpc|publicTrpc/);
  });

  it("server-renders everything but the two client islands", () => {
    expect(read("app/(app)/viewer-landing.tsx")).not.toContain('"use client"');
    expect(read("components/stream-scene.tsx")).not.toContain('"use client"');
    expect(read("components/stream-scene.tsx")).toContain("DEMO_SESSION");
  });

  it("keeps the owner's sign-in button name the e2e suite looks up", () => {
    const source = read("app/(app)/owner-sign-in.tsx");
    expect(source).toMatch(/>\s*<TwitchIcon[^>]*\/>\s*Sign in with Twitch\s*</);
  });

  it("is the only Twitch sign-in on `/` (the header's signed-out button steps aside)", () => {
    expect(read("components/user-menu.tsx")).toMatch(
      /if \(session === null\) \{[\s\S]*?if \(pathname === "\/"\) return null;/,
    );
  });

  it("replaces the old client-rendered home page", () => {
    expect(() => read("app/(app)/home-content.tsx")).toThrow();
    expect(read("app/(app)/page.tsx")).toContain("ViewerLanding");
  });
});
