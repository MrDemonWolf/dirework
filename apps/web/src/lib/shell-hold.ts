// Lets a page's server data hold the (app) layout's shell, so a hard load streams the page
// finished instead of its loading.tsx skeleton.
//
// Why: loading.tsx puts a Suspense boundary around the page. On a hard load the (app) layout
// (header, session) is the shell; it is ready one api round trip in, while the page is still
// awaiting its prefetch, so the shell flushes with the skeleton in it. React then holds the
// streamed page back until at least 300ms after the skeleton's first paint (its SSR reveal
// throttle), so even a fast prefetch shows a skeleton and then swaps — measured 20 of 20 hard
// loads of /dashboard/styles. Next renders a route's layouts and page in parallel, so a page
// registers its data here synchronously, before the layout's own await settles; the layout
// then waits for it, and the page is complete when the shell is written: no fallback, no
// throttle. A client navigation never runs the (app) layout, so its loading.tsx skeleton
// still shows the instant a link is clicked. `/` and `/setup` need no hold: no loading.tsx
// wraps them, so they render complete or answer a real redirect (shell-hold.test.ts).
//
// The hold alone narrows the window but cannot close it. React still writes the loading.tsx
// fallbacks into the shell (each segment's Flight row decodes a tick after the shell
// renders) and swaps the page in from hidden segments further down the same response, the
// first reveal on the next animation frame and every later one at least 300ms after it. A
// browser that gets a rendering opportunity while it is still parsing those ~100KB (a slow
// phone; a CPU-starved CI runner: 20 of 20 hard loads at 6x CPU throttling) paints the
// skeleton, reveals the first boundary, and holds the rest back 300ms. So when every held
// piece of work finished, the layout also renders `RENDER_GATE_LINK`: a render-blocking
// `<link rel="expect">` whose target id is never rendered, so the first paint waits until the
// document is parsed and every reveal lands in that one frame. Only then: a page past the
// SECTIONS_READY_MS deadline streams on, and its placeholders must paint at the deadline.

import { cache } from "react";

export interface ShellHold {
  /**
   * Register work the shell should wait for; returns the same promise. `finished` says whether
   * its value is the complete page (no data still streaming); without it, the work counts as
   * unfinished.
   */
  hold<T>(work: Promise<T>, finished?: (value: T) => boolean): Promise<T>;
  /**
   * Settles once every registered piece of work has, whether it resolved or threw, with
   * whether the shell may block the first paint on the whole document: something was held and
   * all of it resolved finished.
   */
  release(): Promise<boolean>;
}

export function createShellHold(): ShellHold {
  const held: Promise<boolean>[] = [];
  return {
    hold(work, finished) {
      // The bookkeeping promise handles its own rejection: on a client navigation the retained
      // (app) layout never calls release(), so a failed load (a redirect, an api outage) would
      // otherwise surface as an unhandled rejection beside the page's own, handled one.
      held.push(
        work.then(
          (value) => finished?.(value) ?? false,
          () => false,
        ),
      );
      return work;
    },
    async release() {
      // A held redirect() or failure belongs to the page that threw it (its error boundary or
      // redirect), never to the layout, which must still render the shell: each held entry
      // already resolves (a failure to false), so nothing thrown reaches here.
      const results = await Promise.all(held);
      return results.length > 0 && results.every(Boolean);
    },
  };
}

/** One hold per server request (React `cache` scopes it to the render). */
const requestShellHold = cache(createShellHold);

/**
 * Page side: `const state = await holdShellFor(loadData(), finished)`, called before any
 * await. `finished` tells the layout the page's data all arrived, so the first paint may wait
 * for the whole document (`RENDER_GATE_LINK`).
 */
export function holdShellFor<T>(work: Promise<T>, finished?: (value: T) => boolean): Promise<T> {
  return requestShellHold().hold(work, finished);
}

/**
 * Layout side: await after the layout's own data, before returning the shell. True when the
 * held page is complete, and the layout renders `RENDER_GATE_LINK`.
 */
export function shellReleased(): Promise<boolean> {
  return requestShellHold().release();
}

/**
 * Props of the render-blocking link the (app) layout puts in `<head>` (React hoists a
 * `<link>`) for a finished held page. Chromium blocks rendering on a `rel="expect"` link until
 * an element with its target id is parsed, or until the document is, and the id is never
 * rendered, so the first frame comes after the last reveal script. Browsers without
 * `rel="expect"` ignore it, and one inserted after the body (a client render) blocks nothing.
 */
export const RENDER_GATE_LINK = {
  rel: "expect",
  href: "#dw-document-end",
  blocking: "render",
} as const;
