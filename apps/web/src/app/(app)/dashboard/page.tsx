import type { Metadata } from "next";

import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { streamDashboard } from "@/lib/server-query";
import { holdShellFor } from "@/lib/shell-hold";
import Dashboard from "./dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Session first (a signed-out visitor is redirected without spending a batch), then ONE
 * streamed batch for every section, waited on for at most `SECTIONS_READY_MS`
 * (lib/progressive.ts): everything that arrives by then is in the first paint, and only a
 * section whose data is later shows its placeholder and fills in on its own.
 */
async function loadDashboard() {
  const session = await requireSession();
  return { session, state: await streamDashboard() };
}

/**
 * Registered with the (app) layout's shell before anything is awaited (lib/shell-hold.ts), so
 * a hard load paints the dashboard in one go instead of a skeleton that swaps 300ms later
 * (React's streamed-reveal throttle). A client navigation still shows loading.tsx instantly.
 */
export default async function DashboardPage() {
  const { session, state } = await holdShellFor(loadDashboard());

  return (
    <HydrationBoundary state={state}>
      <Dashboard session={session} />
    </HydrationBoundary>
  );
}
