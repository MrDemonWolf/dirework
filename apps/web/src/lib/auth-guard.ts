import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server-session";

/**
 * Require an authenticated owner session for a server component / route.
 * Redirects to "/" when there is no authenticated owner, otherwise returns the session.
 * When the api worker can't answer, getServerSession throws and the (app)
 * error boundary offers a retry, so an outage never looks like a sign-out.
 *
 * Use in protected dashboard pages so the session check lives in one place.
 */
export async function requireSession() {
  const session = await getServerSession();

  if (!session?.user?.isOwner) {
    redirect("/");
  }

  return session;
}
