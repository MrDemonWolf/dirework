// Source pins for the header's account menu (components/account-menu.tsx) and for keeping
// the better-auth client and Base UI Menu off the signed-out pages.
//
// - The menu holds Docs and Report a problem (external links), a separator, then a NEUTRAL
//   Sign out: signing out deletes nothing, so it is not a red destructive row.
// - The auth client is imported at click time (lib/load-auth-client.ts), never statically
//   from a header or sign-in component, so `/` and `/setup` don't ship it on first load.
// - The dropdown loads through next/dynamic and only with a session, so signed-out pages
//   never fetch Base UI Menu and floating-ui.
// - The logo sends the owner to /dashboard (its home), not `/`, which only redirects there.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { landingLinks, REPO_URL } from "@/lib/landing-links";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");
/** A file that may not exist yet reads as "", so each assertion fails on its own. */
const readOrEmpty = (file: string) => {
  try {
    return read(file);
  } catch {
    return "";
  }
};

/** Every `<DropdownMenuItem …>` opening tag (attributes only, up to its first `>` child). */
function menuItems(source: string): string[] {
  return [...source.matchAll(/<DropdownMenuItem\b([\s\S]*?)>\s*\n/g)].map((m) => m[1] ?? "");
}

describe("account menu", () => {
  const accountMenu = readOrEmpty("components/account-menu.tsx");

  it("signs out with a neutral item, not the destructive variant", () => {
    expect(accountMenu).toContain("Sign out");
    expect(accountMenu).not.toContain('variant="destructive"');
    expect(accountMenu).toContain("confirmDiscardIfDirty(");
  });

  it("links Docs and Report a problem out in a new tab, through the item's render prop", () => {
    const items = menuItems(accountMenu);
    const links = items.filter((attrs) => attrs.includes("render={"));
    expect(links).toHaveLength(2);
    for (const attrs of links) {
      expect(attrs).toMatch(/render=\{\s*<a\b/);
      expect(attrs).toContain('target="_blank"');
      expect(attrs).toContain('rel="noopener noreferrer"');
    }
    expect(links[0]).toContain("href={links.docs}");
    expect(links[1]).toContain("href={links.reportProblem}");
    expect(accountMenu).toMatch(/>\s*Docs\s*</);
    expect(accountMenu).toMatch(/>\s*Report a problem\s*</);
    expect(accountMenu).toContain("<DropdownMenuSeparator");
    expect(accountMenu).toContain("ExternalLink");
  });

  it("sizes the popup to its content and has no identity block", () => {
    expect(accountMenu).not.toContain("w-56");
    expect(accountMenu).toContain("w-auto");
    expect(accountMenu).not.toContain("DropdownMenuLabel");
  });

  it("builds both link targets from the deploy's docs and the repo URL", () => {
    const links = landingLinks("https://docs.example.com/");
    expect(links.docs).toBe("https://docs.example.com/docs");
    expect(links.reportProblem).toBe(`${REPO_URL}/issues/new`);
    expect(read("app/(app)/layout.tsx")).toContain("landingLinks(process.env.DOCS_URL)");
  });
});

describe("signed-out pages stay light", () => {
  it.each([
    "components/header.tsx",
    "components/user-menu.tsx",
    "components/account-menu.tsx",
    "app/(app)/owner-sign-in.tsx",
    "app/(app)/setup/claim-button.tsx",
  ])("%s never imports the auth client statically", (file) => {
    const source = readOrEmpty(file);
    expect(source).not.toMatch(/^import (?!type )[^;]*["']@\/lib\/auth-client["']/m);
  });

  it("loads the auth client at click time, reloading when the chunk is gone", () => {
    const loader = readOrEmpty("lib/load-auth-client.ts");
    expect(loader).toContain('import("@/lib/auth-client")');
    expect(loader).toContain("location.reload()");
    for (const file of [
      "components/user-menu.tsx",
      "components/account-menu.tsx",
      "app/(app)/owner-sign-in.tsx",
      "app/(app)/setup/claim-button.tsx",
    ]) {
      expect(readOrEmpty(file)).toContain("loadAuthClient()");
    }
  });

  it("loads the dropdown with next/dynamic (SSR on), only with a session", () => {
    const userMenu = read("components/user-menu.tsx");
    expect(userMenu).not.toContain("@/components/ui/dropdown-menu");
    expect(userMenu).toMatch(/dynamic\(\(\) => import\("\.\/account-menu"\)\)/);
    expect(userMenu).not.toContain("ssr: false");
    expect(userMenu).toMatch(/if \(session === null\) \{[\s\S]*?return \(\s*<Button/);
  });
});

describe("header logo", () => {
  it("sends the owner to /dashboard and everyone else to /", () => {
    expect(read("components/header.tsx")).toContain(
      'href={session?.user?.isOwner ? "/dashboard" : "/"}',
    );
  });
});
