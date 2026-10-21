import type { Metadata } from "next";

import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { prefetchDashboard } from "@/lib/server-query";
import Dashboard from "./dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Session first, then the data prefetch — sequential, so a signed-out visitor is redirected
 * without spending a batch. The prefetch is one batched GET to the api worker; its result
 * hydrates the client cache, so the page streams finished instead of as a skeleton.
 */
export default async function DashboardPage() {
  const session = await requireSession();
  const state = await prefetchDashboard();

  return (
    <Suspense>
      <HydrationBoundary state={state}>
        <Dashboard session={session} />
      </HydrationBoundary>
    </Suspense>
  );
}
