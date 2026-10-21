import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_SESSION, formatClock } from "@dirework/overlay-kit";

import { StreamScene } from "@/components/stream-scene";
import { landingLinks } from "@/lib/landing-links";
import { resolveSignInError } from "@/lib/sign-in-errors";
import SetupContent, {
  AFTER_CLAIM_STEPS,
  RECOVERY_ANCHOR,
} from "../../app/(app)/setup/setup-content";

/**
 * The claim page is the first thing a new owner sees, and only while nobody owns the
 * instance. It must stay static (no queries, no polling: an unclaimed instance is often a
 * fresh deploy anyone can load), and keep the heading and button names the first-run e2e
 * spec looks up.
 */

const SRC = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(SRC, file), "utf8");

const SETUP_FILES = [
  "app/(app)/setup/page.tsx",
  "app/(app)/setup/setup-content.tsx",
  "app/(app)/setup/claim-button.tsx",
];

const links = landingLinks(undefined);

function renderSetup(error: string | null = null): string {
  return renderToStaticMarkup(
    createElement(SetupContent, {
      links,
      signInError: error ? resolveSignInError(error) : null,
    }),
  );
}

describe("claim page", () => {
  it("leads with the claim heading and keeps the e2e-facing names", () => {
    // renderToString, like the streamed page, puts `<!-- -->` between adjacent text nodes; the
    // e2e suite greps the raw body for the heading, so each must stay one text node.
    const html = renderToString(createElement(SetupContent, { links, signInError: null }));
    expect(html).toMatch(/<h1[^>]*>Claim your DireWork instance<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>This DireWork is all yours<\/h2>/);
    expect(read("app/(app)/setup/claim-button.tsx")).toMatch(
      />\s*<TwitchIcon[^>]*\/>\s*Claim with Twitch\s*</,
    );
    expect(html).toContain("Claim with Twitch");
  });

  it("explains who becomes the owner and links the recovery steps", () => {
    const html = renderSetup();
    expect(html).toContain("becomes the owner");
    expect(html).toContain(`href="${links.deployGuide}${RECOVERY_ANCHOR}"`);
  });

  it("sends a failed claim back to the claim page", () => {
    expect(read("app/(app)/setup/claim-button.tsx")).toContain('signInWithTwitch("/setup")');
  });

  it("renders the compact stream scene: overlays, no chat", () => {
    const html = renderSetup();
    expect(html).toContain(formatClock(DEMO_SESSION.remainingMs));
    expect(html).not.toContain("Stream chat");
    expect(read("app/(app)/setup/setup-content.tsx")).toMatch(/<StreamScene compact\b/);
  });

  it("lists the three steps after the claim, in order", () => {
    const html = renderSetup();
    const positions = AFTER_CLAIM_STEPS.map((step) => html.indexOf(step.title));
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(AFTER_CLAIM_STEPS.map((step) => step.title)).toEqual([
      "Connect the bot account",
      "Add the overlays to OBS",
      "Viewers join from chat",
    ]);
  });

  it("shows the notice for a `?error=` code, and nothing without one", () => {
    // renderToStaticMarkup escapes apostrophes; compare against the escaped form.
    const escaped = (text: string) => text.replaceAll("'", "&#x27;");
    expect(renderSetup("not_owner")).toContain(escaped(resolveSignInError("not_owner").title));
    expect(renderSetup("anything-else")).toContain(
      escaped(resolveSignInError("signin_failed").title),
    );
    expect(renderSetup()).not.toContain('role="alert"');
  });

  it("is server-rendered: only the button is a client island", () => {
    expect(read("app/(app)/setup/setup-content.tsx")).not.toContain('"use client"');
    expect(read("app/(app)/setup/page.tsx")).not.toContain('"use client"');
    expect(read("app/(app)/setup/claim-button.tsx")).toContain('"use client"');
  });

  it.each(SETUP_FILES)("%s stays static: no queries, polling or tRPC", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/useQuery|useMutation|refetchInterval|setInterval|poll-intervals/);
    expect(source).not.toMatch(/@\/utils\/trpc|lib\/trpc|publicTrpc|useSearchParams/);
  });
});

describe("compact stream scene", () => {
  const full = renderToStaticMarkup(createElement(StreamScene));
  const compact = renderToStaticMarkup(createElement(StreamScene, { compact: true }));

  it("drops the chat strip and keeps both overlays", () => {
    expect(full).toContain("Stream chat");
    expect(compact).not.toContain("Stream chat");
    for (const line of DEMO_SESSION.chat) {
      if (line.kind === "command") expect(compact).not.toContain(line.text);
    }
    expect(compact).toContain(formatClock(DEMO_SESSION.remainingMs));
    for (const task of DEMO_SESSION.tasks) expect(compact).toContain(task.author);
  });
});
