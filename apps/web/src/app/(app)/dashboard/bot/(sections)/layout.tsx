import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { prefetchBot } from "@/lib/server-query";
import { BotDataGate } from "./bot-data";

/**
 * Session first, then the config + user prefetch (see dashboard/page.tsx), ONCE per visit to
 * Bot settings: a layout is kept across navigations between its own pages, so switching
 * sub-pages re-renders only the page and never repeats either request. Every procedure the
 * pages call is owner-only, so this one check covers them all.
 */
export default async function BotSectionsLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const state = await prefetchBot();

  return (
    <Suspense>
      <HydrationBoundary state={state}>
        <BotDataGate>{children}</BotDataGate>
      </HydrationBoundary>
    </Suspense>
  );
}
