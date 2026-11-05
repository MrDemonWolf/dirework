import { redirect } from "next/navigation";

import { getServerSession, requestHasSessionCookie } from "@/lib/server-session";

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

/**
 * The owner pages' loader: the owner session plus `start()`'s data (the page's streamed
 * batch). Ordered by the request's cookie:
 *
 * - **No session cookie:** session first, so a signed-out visitor is redirected without
 *   spending a batch (getServerSession answers null without a fetch, so it costs nothing).
 * - **A session cookie:** the session check and `start()` run together, saving one api round
 *   trip on every owner load. The session still decides: its redirect or error wins even
 *   when the batch fails first, and the batch's result is then dropped. A stale cookie
 *   spends one batch of UNAUTHORIZED procedures (the api refuses each with no data).
 */
export async function loadAsOwner<T>(
  start: () => Promise<T>,
): Promise<{ session: Awaited<ReturnType<typeof requireSession>>; data: T }> {
  if (!(await requestHasSessionCookie())) {
    const session = await requireSession();
    return { session, data: await start() };
  }
  const data = start();
  // The session's outcome is reported first; this keeps a batch failure that lands while
  // it is pending from surfacing as an unhandled rejection.
  data.catch(() => {});
  const session = await requireSession();
  return { session, data: await data };
}
