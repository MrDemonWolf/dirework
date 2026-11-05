import { cache } from "react";
import { headers } from "next/headers";

import { apiOrigin } from "@/lib/api-origin";
import { stampForwardedClient } from "@/lib/auth-proxy";

/**
 * The session as pages get it: only what the header, the account menu, the dashboard
 * greeting and the owner guards read. Pages hand it to client components, whose props are
 * serialized into the RSC payload, so a field the UI needs is added here by name. Nothing
 * else from better-auth's get-session body is passed on; `session.session` is not a field,
 * so a read of it fails type-checking.
 */
export type ServerSession = {
  user: {
    /** The owner's Twitch name: the account menu's label and the dashboard greeting. */
    name: string;
    /** Twitch avatar URL; null draws the name's initial instead. */
    image: string | null;
    /** Owner gate for `requireSession()`, `/` and `/setup`. */
    isOwner: boolean;
  };
};

/** Time box for every server-render fetch to the api worker (session, prefetch, hasOwner). */
export const INTERNAL_FETCH_TIMEOUT_MS = 5_000;

/**
 * The api worker couldn't answer the session check (429, 5xx, timeout, network
 * error, unparseable body or one with no user). Distinct from "signed out" so a blip
 * renders the (app) error boundary with a retry instead of bouncing the owner to sign-in.
 */
export class SessionUnavailableError extends Error {
  constructor() {
    super("The DireWork API could not verify your session");
    this.name = "SessionUnavailableError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Builds `ServerSession` from the get-session body field by field. The body is never
 * spread or returned: besides the user it carries the session row, raw `token` included
 * (the credential the HttpOnly cookie keeps away from scripts), and the user row's
 * placeholder email. Ownership counts only as a JSON `true`, so a malformed body fails
 * closed.
 */
function toServerSession(body: unknown): ServerSession | null {
  // better-auth returns a JSON `null` body when there is no session.
  if (body === null) return null;
  const user = isRecord(body) ? body.user : undefined;
  if (!isRecord(user)) throw new SessionUnavailableError();
  return {
    user: {
      name: typeof user.name === "string" ? user.name : "",
      image: typeof user.image === "string" ? user.image : null,
      isOwner: user.isOwner === true,
    },
  };
}

/**
 * Resolve the current session from a server component on the web worker.
 *
 * The web worker has no DB binding and no @dirework/auth instance — session
 * checks are delegated to the api worker's better-auth handler by forwarding
 * the incoming request's cookie header. `disableRefresh` because this fetch
 * can't pass a refreshed Set-Cookie back to the browser — sliding the session
 * here would extend the D1 row while the browser cookie still expires. The answer is
 * narrowed to `ServerSession` (toServerSession), never passed through.
 *
 * Returns null ONLY when the api worker answered 2xx with no session; any other
 * outcome throws SessionUnavailableError.
 *
 * `cache()`d per request: the (app) layout's header and the page's
 * `requireSession()` share ONE get-session fetch. A rejection is memoised too,
 * so a failed check is not retried within the same render.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
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
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new SessionUnavailableError();
  }
  return toServerSession(body);
});

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
