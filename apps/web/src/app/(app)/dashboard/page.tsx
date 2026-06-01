import { Suspense } from "react";

import { requireSession } from "@/lib/auth-guard";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <Suspense>
      <Dashboard session={session} />
    </Suspense>
  );
}
