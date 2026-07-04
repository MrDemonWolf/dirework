import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server-session";

/**
 * Require an authenticated owner session for a server component / route.
 * Redirects to "/" when there is no signed-in user, otherwise returns the session.
 *
 * Use in protected dashboard pages so the session check lives in one place.
 */
export async function requireSession() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  return session;
}
