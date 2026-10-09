import type { Metadata } from "next";

import { Suspense } from "react";

import { requireSession } from "@/lib/auth-guard";
import Dashboard from "./dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <Suspense>
      <Dashboard session={session} />
    </Suspense>
  );
}
