import { headers } from "next/headers";

import { apiOrigin } from "@/lib/api-origin";
import { stampForwardedClient } from "@/lib/auth-proxy";
import type { authClient } from "@/lib/auth-client";

/**
 * Session shape as inferred by the better-auth client ({ session, user }).
 * Type-only import — nothing from the react client is bundled server-side.
 */
export type ServerSession = typeof authClient.$Infer.Session;

const INTERNAL_FETCH_TIMEOUT_MS = 5_000;

/**
 * The api worker couldn't answer the session check (429, 5xx, timeout, network
 * error, unparseable body). Distinct from "signed out" so a blip renders the
 * (app) error boundary with a retry instead of bouncing the owner to sign-in.
 */
export class SessionUnavailableError extends Error {
  constructor() {
    super("The Dirework API could not verify your session");
    this.name = "SessionUnavailableError";
  }
}

/**
 * Resolve the current session from a server component on the web worker.
 *
 * The web worker has no DB binding and no @dirework/auth instance — session
 * checks are delegated to the api worker's better-auth handler by forwarding
 * the incoming request's cookie header. `disableRefresh` because this fetch
 * can't pass a refreshed Set-Cookie back to the browser — sliding the session
 * here would extend the D1 row while the browser cookie still expires.
 *
 * Returns null ONLY when the api worker answered 2xx with no session; any other
 * outcome throws SessionUnavailableError.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const h = await headers();

  let res: Response;
  try {
    // Signed client IP: without it this check would share the api limiter's
    // bucket with every other proxied client (the web worker's egress IP).
    const outgoing = await stampForwardedClient(new Headers({ cookie: h.get("cookie") ?? "" }), h);
    res = await fetch(`${apiOrigin()}/api/auth/get-session?disableRefresh=true`, {
      headers: outgoing,
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new SessionUnavailableError();
  }
  if (!res.ok) throw new SessionUnavailableError();
  try {
    // better-auth returns a JSON `null` body when there is no session.
    return ((await res.json()) as ServerSession | null) ?? null;
  } catch {
    throw new SessionUnavailableError();
  }
}

/**
 * Whether this single-tenant instance has already been claimed by an owner.
 *
 * Delegates to the api worker's public `user.hasOwner` tRPC query (no input,
 * no credentials). Fails safe to `true` (claimed) so a transient api-worker
 * error shows the login page instead of the setup/claim flow — better-auth's
 * user-create hook on the api worker is the real single-owner enforcement.
 */
export async function getInstanceOwned(): Promise<boolean> {
  try {
    const res = await fetch(`${apiOrigin()}/trpc/user.hasOwner`, {
      headers: await stampForwardedClient(new Headers(), await headers()),
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return true;
    const body = (await res.json()) as { result?: { data?: unknown } };
    return Boolean(body?.result?.data ?? true);
  } catch {
    return true;
  }
}
