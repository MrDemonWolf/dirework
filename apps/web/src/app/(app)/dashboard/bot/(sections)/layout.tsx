import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";

import { requireSession } from "@/lib/auth-guard";
import { streamBot } from "@/lib/server-query";
import { holdShellFor } from "@/lib/shell-hold";

/**
 * Session first (a signed-out visitor is redirected without spending a batch), then ONE
 * streamed batch for `config.get` + `user.me`, waited on for at most `SECTIONS_READY_MS`
 * (lib/progressive.ts), exactly like the dashboard. Each page's cards are `BotSection`s
 * (./bot-data.tsx): a card whose query made the deadline paints with the page, one whose
 * query is slower shows its placeholder and fills in from the same request.
 */
async function loadBot() {
  await requireSession();
  return streamBot();
}

/**
 * Runs ONCE per visit to Bot settings: a layout is kept across navigations between its own
 * pages, so switching sub-pages re-renders only the page and never repeats the batch. Every
 * procedure the pages call is owner-only, so this one check covers them all.
 *
 * Registered with the (app) layout's shell before anything is awaited (lib/shell-hold.ts), so
 * a hard load paints the heading, sub-nav and cards in one go instead of bot/loading.tsx's
 * skeleton that swaps 300ms later. A client navigation still shows that skeleton instantly.
 */
export default async function BotSectionsLayout({ children }: { children: React.ReactNode }) {
  const state = await holdShellFor(loadBot());

  return (
    <Suspense>
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
    </Suspense>
  );
}
