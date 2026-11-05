"use client";

// The (app) routes' client providers, mounted by app/(app)/layout.tsx: theme (next-themes,
// through the store bridge in theme-provider.tsx) and React Query. The root layout mounts
// none: the (overlay) layout mounts only React Query (OverlayQueryProvider) and the (bot)
// layout nothing, so the token pages never load next-themes, and the bot page no React Query.
// The toast host is not here either: AppToaster (app-toaster.tsx) is a sibling inside it.

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { getQueryClient } from "@/utils/query-client";

import { ThemeProvider } from "./theme-provider";

/**
 * Wraps every (app) route. Uses the shared browser QueryClient from `getQueryClient()` (a fresh one
 * per server render), so the tRPC hooks and this provider see the same cache.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  // Dark is the hero theme — streamers live in dark UIs next to OBS
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* The devtools package renders nothing in production builds. */}
        <ReactQueryDevtools />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
