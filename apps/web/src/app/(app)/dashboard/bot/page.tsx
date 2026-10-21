import type { Metadata } from "next";

import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { prefetchBot } from "@/lib/server-query";
import BotSettingsPage from "./bot-settings-page";

export const metadata: Metadata = { title: "Bot settings" };

/** Session first, then the config + user prefetch (see dashboard/page.tsx). */
export default async function BotRoute() {
  await requireSession();
  const state = await prefetchBot();

  return (
    <Suspense>
      <HydrationBoundary state={state}>
        <BotSettingsPage />
      </HydrationBoundary>
    </Suspense>
  );
}
