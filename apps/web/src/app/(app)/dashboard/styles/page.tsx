import type { Metadata } from "next";

import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { prefetchStyles } from "@/lib/server-query";
import StylesPage from "./styles-page";

export const metadata: Metadata = { title: "Theme Center" };

/** Session first, then the config prefetch (see dashboard/page.tsx). */
export default async function StylesRoute() {
  await requireSession();
  const state = await prefetchStyles();

  return (
    <>
      {/* The live preview renders the overlays' configured faces inline (not in an iframe),
          so this page loads the overlay font stylesheet like the (overlay) layout does. */}
      <link rel="stylesheet" href="/fonts/fonts.css" precedence="default" />
      <Suspense>
        <HydrationBoundary state={state}>
          <StylesPage />
        </HydrationBoundary>
      </Suspense>
    </>
  );
}
