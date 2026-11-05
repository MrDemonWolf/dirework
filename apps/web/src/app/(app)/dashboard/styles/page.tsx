import type { Metadata } from "next";

import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { loadAsOwner } from "@/lib/auth-guard";
import { streamStyles } from "@/lib/server-query";
import { holdShellFor } from "@/lib/shell-hold";
import StylesPage from "./styles-page";
import { StylesSection } from "./styles-section";

export const metadata: Metadata = { title: "Theme Center" };

/**
 * The owner session and ONE streamed `config.get`, started together when the request carries
 * a session cookie and session first when it doesn't, so a signed-out visitor never spends a
 * batch (`loadAsOwner`, lib/auth-guard.ts). The batch is waited on for at most
 * `SECTIONS_READY_MS` (lib/progressive.ts), exactly like the dashboard: a config that arrives
 * by then is in the first paint, and a slower one shows the page's skeleton
 * (./styles-section.tsx) and fills it in from the same request.
 */
async function loadStyles() {
  return (await loadAsOwner(streamStyles)).data;
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
          <StylesSection>
            <StylesPage />
          </StylesSection>
        </HydrationBoundary>
      </Suspense>
    </>
  );
}
