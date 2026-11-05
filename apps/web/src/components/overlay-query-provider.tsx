"use client";

// The (overlay) layout's only client provider: the overlays poll with useQuery, so they need
// React Query, but they never read the theme (the root <head> script still sets the class and
// marks their canvas transparent) and never call the dashboard's /rpc client.

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/utils/query-client";

/** React Query for the OBS overlays, over the same browser QueryClient the dashboard builds. */
export function OverlayQueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
