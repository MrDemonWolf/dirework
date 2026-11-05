// Source pins for the dashboard's OBS live preview. Its iframe loads the overlay page flagged
// as a preview (`?preview=1`), and both overlay pages stop their poll in a hidden tab only when
// they see that flag. An OBS browser source loads the plain URL and keeps polling in the
// background, exactly as before. The polling itself runs against a real QueryClient in
// poll-intervals.test.ts; the flag's helpers are tested in overlay-view.test.ts.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

const obsSources = read("components/obs-sources.tsx");
const overlayPages = [
  ["timer", read("app/(overlay)/overlay/t/[token]/page.tsx")],
  ["tasks", read("app/(overlay)/overlay/l/[token]/page.tsx")],
] as const;

describe("the dashboard's live preview", () => {
  it("loads the overlay page flagged as a preview in its one iframe", () => {
    expect(obsSources.match(/<iframe/g)).toHaveLength(1);
    expect(obsSources).toMatch(/<iframe\s+src=\{overlayPreviewSrc\(path\)\}/);
  });

  it("keeps the flag off the URL handed to OBS", () => {
    // The iframe is the flag's only use; the URL row shows and copies the plain path.
    expect(obsSources.match(/overlayPreviewSrc\(/g) ?? []).toHaveLength(1);
    expect(obsSources).toMatch(/<SecretUrlRow\s+label=\{label\}\s+path=\{src\}/);
    expect(obsSources).toContain('timer: overlayPath("timer", me.data?.overlayTimerToken),');
    expect(obsSources).toContain('tasks: overlayPath("tasks", me.data?.overlayTasksToken),');
  });
});

describe.each(overlayPages)("the %s overlay page", (_kind, page) => {
  it("reads the preview flag from its own URL", () => {
    expect(page).toContain("const preview = isOverlayPreview(useSearchParams());");
  });

  it("polls like every overlay, except that a preview stops in a hidden tab", () => {
    // The override comes after the spread, or the shared `true` would win.
    expect(page).toMatch(
      /\.\.\.OVERLAY_POLL_QUERY_OPTS,\n\s*refetchIntervalInBackground: !preview,\n/,
    );
    // The cadence, the background flag and the silence come from poll-intervals.ts only.
    expect(page).not.toMatch(
      /refetchInterval: OVERLAY_POLL_MS|refetchIntervalInBackground: true|meta: \{ silent: true \}/,
    );
  });
});
