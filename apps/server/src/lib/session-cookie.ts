/**
 * Offline verification of a better-auth session cookie, for the rate limiter.
 *
 * The limiter runs BEFORE better-auth, so it cannot ask the database whether a
 * session is real. Keying on the raw cookie value would let an attacker mint a
 * fresh bucket per request with random cookies and bypass the limit entirely.
 * better-auth (better-call) signs the cookie instead —
 * `encodeURIComponent(token + "." + base64(HMAC-SHA256(BETTER_AUTH_SECRET, token)))`
 * — so the signature can be checked with no I/O: only a cookie better-auth
 * itself issued can earn a per-session key. Everything else falls back to the
 * (trusted) client IP.
 */

/** `__Secure-` when served over https (production), bare on http dev. */
export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

const HMAC = { name: "HMAC", hash: "SHA-256" } as const;
/** better-call's signature: base64 of a 32-byte HMAC, always 44 chars ending "=". */
const SIGNATURE_LENGTH = 44;
/** A real cookie is ~80 bytes; bound the work an attacker can make us do. */
const MAX_COOKIE_VALUE_LENGTH = 512;
const encoder = new TextEncoder();

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

async function verifySignedValue(raw: string, secret: string): Promise<string | null> {
  if (raw.length > MAX_COOKIE_VALUE_LENGTH) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const token = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (signature.length !== SIGNATURE_LENGTH || !signature.endsWith("=")) return null;

  try {
    const binary = atob(signature);
    const sig = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) sig[i] = binary.charCodeAt(i);
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), HMAC, false, [
      "verify",
    ]);
    return (await crypto.subtle.verify(HMAC, key, sig, encoder.encode(token))) ? token : null;
  } catch {
    return null;
  }
}

/**
 * The session token from a correctly signed better-auth session cookie, or
 * null (no cookie, no secret, tampered or forged signature). Says nothing
 * about whether the session is still live — better-auth decides that later.
 */
export async function verifiedSessionToken(
  headers: Headers,
  secret: string | undefined,
): Promise<string | null> {
  if (!secret) return null;
  const cookieHeader = headers.get("cookie");
  for (const name of SESSION_COOKIE_NAMES) {
    const raw = readCookie(cookieHeader, name);
    if (raw) {
      const token = await verifySignedValue(raw, secret);
      if (token) return token;
    }
  }
  return null;
}

/** Short, non-reversible id for a session token (the raw token never becomes a key). */
export async function sessionKeyId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
