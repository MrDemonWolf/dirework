import type { Metadata } from "next";

import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { prefetchStyles } from "@/lib/server-query";
import { holdShellFor } from "@/lib/shell-hold";
import StylesPage from "./styles-page";

export const metadata: Metadata = { title: "Theme Center" };

/** Session first, then the config prefetch (see dashboard/page.tsx). */
async function loadStyles() {
  await requireSession();
  return prefetchStyles();
}

/**
 * Registered with the (app) layout's shell before anything is awaited (lib/shell-hold.ts), so
 * a hard load arrives finished rather than as the loading.tsx skeleton; a client navigation
 * still shows that skeleton instantly.
 */
export default async function StylesRoute() {
  const state = await holdShellFor(loadStyles());

  return (
    <>
      {/* The live preview renders the overlays' configured faces inline (not in an iframe),
          so this page loads the overlay font stylesheet like the (overlay) layout does. In the
          shell on a hard load, so it is in <head> before the first paint. */}
      <link rel="stylesheet" href="/fonts/fonts.css" precedence="default" />
      <Suspense>
        <HydrationBoundary state={state}>
          <StylesPage />
        </HydrationBoundary>
      </Suspense>
    </>
  );
}
