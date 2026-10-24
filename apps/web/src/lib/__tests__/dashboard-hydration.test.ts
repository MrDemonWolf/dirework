// Source pins for the SSR prefetch + hydration wiring: a page that loses its
// HydrationBoundary, or a component that goes back to a client session fetch, silently
// brings back the skeleton hand-off and the extra billed requests.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

describe("dashboard SSR hydration", () => {
  it("renders the live dashboard without waiting on a client user.me fetch", () => {
    const dashboard = read("app/(app)/dashboard/dashboard.tsx");
    // No whole-page skeleton gate: each section has its own boundary and placeholder
    // (lib/progressive.ts), and a failed `me` keeps the frame in place.
    expect(dashboard).not.toContain("<DashboardSkeleton");
    expect(dashboard).not.toMatch(/if \(user\.isPending\) return/);
    expect(dashboard).toContain("<ProgressiveSection");
  });

  it.each([
    ["app/(app)/dashboard/page.tsx", "streamDashboard"],
    ["app/(app)/dashboard/styles/page.tsx", "prefetchStyles"],
    // Bot settings prefetches once in the layout its sub-pages share.
    ["app/(app)/dashboard/bot/(sections)/layout.tsx", "prefetchBot"],
  ])("%s wraps its tree in a HydrationBoundary fed by %s", (file, prefetch) => {
    const page = read(file);
    expect(page).toContain("<HydrationBoundary state={state}>");
    // Awaited directly, or (the Theme Center) inside the loader the page holds the shell
    // for, `await holdShellFor(loadStyles())`; shell-hold.test.ts pins that wiring.
    expect(page).toMatch(new RegExp(`(await|return) ${prefetch}\\(\\)`));
  });

  it.each(["components/header.tsx", "components/user-menu.tsx"])(
    "%s takes the server session as a prop instead of fetching it",
    (file) => {
      const component = read(file);
      expect(component).not.toContain("useSession(");
      expect(component).toContain("session: ServerSession | null");
    },
  );

  it.each([
    "app/(app)/dashboard/styles/styles-page.tsx",
    "app/(app)/dashboard/bot/(sections)/commands/commands-page.tsx",
    "app/(app)/dashboard/bot/(sections)/replies/replies-page.tsx",
  ])(
    "%s seeds its editors from the hydrated config in state, not in a post-mount effect",
    (file) => {
      const page = read(file);
      // The effect-copy pattern painted (and served) defaults first, then swapped in the
      // saved values after hydration — an edit landing during the swap was appended to them.
      expect(page).not.toContain("initializedRef");
      expect(page).not.toMatch(/useEffect\(\(\) => \{\s*if \(!config\.data\) return;/);
      expect(page).toMatch(/return <\w+Editor config=\{config(\.data)?\}/);
    },
  );

  it("keeps the Bot settings shell data-free, so a link prefetch never reaches the api", () => {
    // The heading + sub-nav layout sits above bot/loading.tsx; the session check and the
    // prefetch sit below it, in (sections)/layout.tsx, where a prefetch stops short.
    const shell = read("app/(app)/dashboard/bot/layout.tsx");
    expect(shell).not.toMatch(/requireSession|prefetchBot|getServerSession|async function/);
    expect(read("app/(app)/dashboard/bot/(sections)/layout.tsx")).toMatch(
      /await requireSession\(\);\s*const state = await prefetchBot\(\);/,
    );
    // Sub-nav links never prefetch.
    expect(read("components/bot-settings/bot-section-nav.tsx")).toContain("prefetch={false}");
  });

  it("keeps hydrated data fresh on mount via the client default staleTime", () => {
    expect(read("utils/trpc.ts")).toContain("staleTime: QUERY_FRESH_MS");
  });
});
