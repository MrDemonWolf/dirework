/**
 * The better-auth session cookie's names, and a Cookie-header reader for them.
 *
 * Zod-free and env-free, shared by both workers: the api worker's rate limiter keys a
 * verified session cookie (apps/server/src/lib/session-cookie.ts), and the web worker skips
 * its get-session fetch for a request that carries neither name
 * (apps/web/src/lib/server-session.ts). Presence only: nothing here says the cookie is
 * genuine or the session live.
 */

/** `__Secure-` when served over https (production), bare on http dev. */
export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

/** Read one cookie from a Cookie header (first match wins). */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Whether the Cookie header carries a non-empty better-auth session cookie under either name. */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(readCookie(cookieHeader, name)));
}
