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
// still shows the instant a link is clicked.

import { cache } from "react";

export interface ShellHold {
  /** Register work the shell should wait for; returns the same promise. */
  hold<T>(work: Promise<T>): Promise<T>;
  /** Settles once every registered piece of work has, whether it resolved or threw. */
  release(): Promise<void>;
}

export function createShellHold(): ShellHold {
  const held: Promise<unknown>[] = [];
  return {
    hold(work) {
      held.push(work);
      return work;
    },
    async release() {
      // allSettled: a held redirect() or failure belongs to the page that threw it (its error
      // boundary or redirect), never to the layout, which must still render the shell.
      await Promise.allSettled(held);
    },
  };
}

/** One hold per server request (React `cache` scopes it to the render). */
const requestShellHold = cache(createShellHold);

/** Page side: `const state = await holdShellFor(loadData())`, called before any await. */
export function holdShellFor<T>(work: Promise<T>): Promise<T> {
  return requestShellHold().hold(work);
}

/** Layout side: await after the layout's own data, before returning the shell. */
export function shellReleased(): Promise<void> {
  return requestShellHold().release();
}
