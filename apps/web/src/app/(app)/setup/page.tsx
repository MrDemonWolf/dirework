import { notFound, redirect } from "next/navigation";

import { getInstanceOwned, getServerSession } from "@/lib/server-session";
import SetupContent from "./setup-content";

export const metadata = {
  title: "Setup — DireWork",
  description: "Claim this DireWork instance as the streamer.",
};

export default async function SetupPage() {
  const [owned, session] = await Promise.all([
    getInstanceOwned(),
    getServerSession(),
  ]);

  // Instance already claimed — this route no longer exists
  if (owned) {
    notFound();
  }

  // Already signed in (shouldn't happen on fresh install, but handle gracefully)
  if (session?.user) {
    redirect("/dashboard");
  }

  return <SetupContent />;
}
