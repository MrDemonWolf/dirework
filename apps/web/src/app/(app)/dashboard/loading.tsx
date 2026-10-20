// Route-level loading UI. Next shows it the instant a client-side navigation to /dashboard
// starts, while the page's `requireSession()` round-trips to the api worker; without it the
// previous page just sits there until the new one arrives. It is the same skeleton the page
// renders until its first query resolves, so the hand-off between the two is invisible.

import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
