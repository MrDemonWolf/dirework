import { notFound, redirect } from "next/navigation";

import { getInstanceOwned, getServerSession } from "@/lib/server-session";
import SetupContent from "./setup-content";

export const metadata = {
  title: "Setup — DireWork",
  description: "Claim this DireWork instance as the streamer.",
};

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
