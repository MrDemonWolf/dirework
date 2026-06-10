import { Suspense } from "react";

import { requireSession } from "@/lib/auth-guard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard session={session} />
    </Suspense>
  );
}
