import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@dirework/auth";

/**
 * Require an authenticated owner session for a server component / route.
 * Redirects to "/" when there is no signed-in user, otherwise returns the session.
 *
 * Use in protected dashboard pages so the session check lives in one place.
 */
export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  return session;
}
