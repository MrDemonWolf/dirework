import { proxyRpcToApi } from "@/lib/auth-proxy";

/**
 * Authenticated tRPC, same-origin: the browser calls /rpc/* with its session
 * cookie and this handler streams it to the api worker's /trpc/*. A route
 * handler rather than a next.config rewrite so every request carries the
 * browser's IP signed with PROXY_SECRET — see lib/auth-proxy.ts.
 */
export const GET = proxyRpcToApi;
export const POST = proxyRpcToApi;
