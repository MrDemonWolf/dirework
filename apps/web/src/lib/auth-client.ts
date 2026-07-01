import { createAuthClient } from "better-auth/react";

/**
 * Same-origin better-auth client. Requests go to the default /api/auth/* on
 * the web worker origin, which the Next rewrite proxies to the api worker.
 * Do NOT point this at NEXT_PUBLIC_SERVER_URL — workers.dev is on the Public
 * Suffix List, so cookies cannot cross the web/api worker origins.
 */
export const authClient = createAuthClient({});
