/**
 * Trusted client-IP forwarding between the web worker and the api worker.
 *
 * Every authenticated browser request reaches the api worker through the web
 * worker's same-origin proxy (/rpc, /api/auth, /api/bot, SSR session checks).
 * On that hop the api worker's CF-Connecting-IP is the web worker's egress
 * address, not the browser's, so keying the rate limiter on it collapses every
 * proxied client into ONE bucket (anyone could drain it and lock the owner
 * out). The web worker therefore forwards the real client IP — its own incoming
 * CF-Connecting-IP — together with an HMAC of that IP under PROXY_SECRET, a
 * secret bound to both workers and never sent to a browser. The api worker
 * trusts the forwarded IP only when the HMAC verifies, so a client calling the
 * api worker directly cannot pick its own rate-limit key.
 *
 * Pure WebCrypto, no env import: shared by apps/web (signing) and apps/server
 * (verifying), and testable under Node.
 */

/** The browser's IP as seen by the web worker. */
export const CLIENT_IP_HEADER = "x-dirework-client-ip";
/** base64url HMAC-SHA256(PROXY_SECRET, CLIENT_IP_CONTEXT + ip). */
export const CLIENT_IP_SIGNATURE_HEADER = "x-dirework-client-ip-sig";

/** Domain separation: this key signs nothing else, but versioning is free. */
const CLIENT_IP_CONTEXT = "dirework-client-ip:v1:";
const HMAC = { name: "HMAC", hash: "SHA-256" } as const;
/** An IPv6 literal is ≤45 chars; anything longer is not a real client IP. */
const MAX_IP_LENGTH = 64;
const encoder = new TextEncoder();

function importKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", encoder.encode(secret), HMAC, false, [usage]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) return null;
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function signClientIp(ip: string, secret: string): Promise<string> {
  const key = await importKey(secret, "sign");
  return toBase64Url(await crypto.subtle.sign(HMAC, key, encoder.encode(CLIENT_IP_CONTEXT + ip)));
}

/** Constant-time (crypto.subtle.verify) check of a forwarded IP's signature. */
export async function verifyClientIp(
  ip: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!ip || ip.length > MAX_IP_LENGTH || !secret) return false;
  const sig = fromBase64Url(signature);
  if (!sig) return false;
  try {
    const key = await importKey(secret, "verify");
    return await crypto.subtle.verify(HMAC, key, sig, encoder.encode(CLIENT_IP_CONTEXT + ip));
  } catch {
    return false;
  }
}

/**
 * Overwrite the identity headers on an outgoing api-worker request. Any copy a
 * client supplied is ALWAYS dropped first; the stamp is added only when both
 * the incoming IP and the secret are known (local `next dev` without a secret
 * simply forwards nothing, and the api worker falls back to CF-Connecting-IP).
 */
export async function stampClientIp(
  headers: Headers,
  clientIp: string | null | undefined,
  secret: string | null | undefined,
): Promise<Headers> {
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(CLIENT_IP_SIGNATURE_HEADER);
  if (!clientIp || clientIp.length > MAX_IP_LENGTH || !secret) return headers;
  headers.set(CLIENT_IP_HEADER, clientIp);
  headers.set(CLIENT_IP_SIGNATURE_HEADER, await signClientIp(clientIp, secret));
  return headers;
}
