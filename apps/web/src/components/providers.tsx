"use client";

// Root client providers, mounted once by app/layout.tsx around every route: theme
// (next-themes), React Query, and the global toast host.

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { getQueryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

// Sonner's own gutters (24px, 16px under 600px wide) plus the safe-area insets, which are
// non-zero on a phone with viewport-fit=cover (bottom: home indicator; left/right: the
// notch in landscape, where Sonner uses the desktop `offset`). While a SaveBar is shown,
// index.css sets `--save-bar-clearance` to its height, so toasts stack above it on every page
// that has one rather than over its Reset / Save buttons.
export const TOAST_OFFSET = {
  bottom: "calc(24px + var(--save-bar-clearance, 0px) + env(safe-area-inset-bottom, 0px))",
  left: "calc(24px + env(safe-area-inset-left, 0px))",
  right: "calc(24px + env(safe-area-inset-right, 0px))",
};
export const TOAST_MOBILE_OFFSET = {
  bottom: "calc(1rem + var(--save-bar-clearance, 0px) + env(safe-area-inset-bottom, 0px))",
  left: "calc(1rem + env(safe-area-inset-left, 0px))",
  right: "calc(1rem + env(safe-area-inset-right, 0px))",
};

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
      {/* Clear of the notch and home indicator when installed to a phone's home screen. */}
      <Toaster richColors offset={TOAST_OFFSET} mobileOffset={TOAST_MOBILE_OFFSET} />
    </ThemeProvider>
  );
}
