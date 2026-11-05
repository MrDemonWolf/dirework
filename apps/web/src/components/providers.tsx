"use client";

// Root client providers, mounted once by app/layout.tsx around every route: theme
// (next-themes) and React Query. The toast host is not here: AppToaster (app-toaster.tsx)
// is mounted by the (app) layout only, so the OBS overlays and the bot page never load sonner.

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { getQueryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";

/**
 * Wraps the whole app. Uses the shared browser QueryClient from `getQueryClient()` (a fresh one
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
