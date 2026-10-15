// Server gate for /setup: the claim page exists only while the instance is unclaimed.

import type { Metadata } from "next";

import { notFound, redirect } from "next/navigation";

import { getInstanceOwned, getServerSession } from "@/lib/server-session";
import SetupContent from "./setup-content";

export const metadata: Metadata = {
  title: "Setup",
  description: "Claim this DireWork instance as the streamer.",
};

/**
 * Owner session -> /dashboard; already claimed -> 404; otherwise render the claim screen.
 * `getInstanceOwned` fails closed (reports "owned" when the api can't be reached), so an api
 * outage 404s this page rather than offering a claim the server would refuse anyway.
 */
export default async function SetupPage() {
  const [owned, session] = await Promise.all([getInstanceOwned(), getServerSession()]);

  // An authenticated owner goes straight to the dashboard.
  if (session?.user?.isOwner) {
    redirect("/dashboard");
  }

  // Instance already claimed, no owner session — this route no longer exists.
  if (owned) {
    notFound();
  }

  return <SetupContent />;
}
