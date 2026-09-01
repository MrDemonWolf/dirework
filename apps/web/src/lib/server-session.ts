import { headers } from "next/headers";

import type { authClient } from "@/lib/auth-client";

/**
 * Session shape as inferred by the better-auth client ({ session, user }).
 * Type-only import — nothing from the react client is bundled server-side.
 */
export type ServerSession = typeof authClient.$Infer.Session;

function serverUrl(): string {
  return process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";
}

/**
 * Budget for a single api-worker call made during server-side render.
 *
 * Shorter than the OAuth proxy's 15s (lib/auth-proxy.ts): that one streams a
 * proxied body, this one blocks a render. Without a signal, a stalled api
 * worker hangs the page until the Workers wall-clock limit kills it — a slow
 * dependency becomes a 500. Both callers below already fail safe on throw.
 */
const SSR_TIMEOUT_MS = 5_000;

/**
 * Resolve the current session from a server component on the web worker.
 *
 * The web worker has no DB binding and no @dirework/auth instance — session
 * checks are delegated to the api worker's better-auth handler by forwarding
 * the incoming request's cookie header.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const h = await headers();

  try {
    const res = await fetch(`${serverUrl()}/api/auth/get-session`, {
      headers: { cookie: h.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(SSR_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    // better-auth returns a JSON `null` body when there is no session.
    return ((await res.json()) as ServerSession | null) ?? null;
  } catch {
    return null;
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
    const res = await fetch(`${serverUrl()}/trpc/user.hasOwner`, {
      cache: "no-store",
      signal: AbortSignal.timeout(SSR_TIMEOUT_MS),
    });
    if (!res.ok) return true;
    const body = (await res.json()) as { result?: { data?: unknown } };
    return Boolean(body?.result?.data ?? true);
  } catch {
    return true;
  }
}
