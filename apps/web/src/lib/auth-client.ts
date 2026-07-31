import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

/**
 * Same-origin better-auth client. Requests go to the default /api/auth/* on
 * the web worker origin, which the route handler at app/api/auth/[...all]
 * proxies verbatim to the api worker (see lib/auth-proxy.ts).
 * Do NOT point this at NEXT_PUBLIC_SERVER_URL — workers.dev is on the Public
 * Suffix List, so cookies cannot cross the web/api worker origins.
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        isOwner: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    }),
  ],
});
