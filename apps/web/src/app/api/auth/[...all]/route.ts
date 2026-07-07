import { proxyToApi } from "@/lib/auth-proxy";

/**
 * better-auth lives on the api worker; the browser must talk to it
 * same-origin so session cookies land on the web origin. A Next rewrite
 * can't do this (it follows redirects and drops their Set-Cookie), so this
 * route handler proxies verbatim — see lib/auth-proxy.ts.
 */
export const GET = proxyToApi;
export const POST = proxyToApi;
