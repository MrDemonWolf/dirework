"use client";

// Root client providers, mounted once by app/layout.tsx around every route: theme
// (next-themes), React Query, and the global toast host.

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { getQueryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

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
      {/* Clear of the home indicator when installed to a phone's home screen. */}
      <Toaster
        richColors
        mobileOffset={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      />
    </ThemeProvider>
  );
}
