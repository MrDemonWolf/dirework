import { proxyToApi } from "@/lib/auth-proxy";

/**
 * Bot-account OAuth (authorize + Twitch callback) on the api worker. Both
 * endpoints answer with redirects, which a Next rewrite would follow
 * internally instead of passing to the browser — see lib/auth-proxy.ts.
 */
export const GET = proxyToApi;
