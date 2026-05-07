import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth, hasOwner } from "@dirework/auth";
import SetupContent from "./setup-content";

export const metadata = {
  title: "Setup — DireWork",
  description: "Claim this DireWork instance as the streamer.",
};

export default async function SetupPage() {
  const [owned, session] = await Promise.all([
    hasOwner(),
    auth.api.getSession({ headers: await headers() }),
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
