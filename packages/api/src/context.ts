import type { Context as HonoContext } from "hono";

import { createAuth } from "@dirework/auth";
import { createDb } from "@dirework/db";

// Per-request factories — Workers isolate per request, no module singletons.
export async function createContext({
  context,
  recordClientCrash,
}: {
  context: HonoContext;
  /**
   * Logs one `client.crash` metric with this label (`crash.report`). Injected by the api
   * worker, which owns telemetry, so packages/api stays free of @dirework/env/server.
   */
  recordClientCrash?: (label: string) => void;
}) {
  // disableRefresh: a server-side read can't hand a refreshed Set-Cookie back
  // to the browser, so sliding the D1 row here would leave the cookie behind.
  // Only browser-originated reads (useSession via the web proxy) slide it.
  const session = await createAuth().api.getSession({
    headers: context.req.raw.headers,
    query: { disableRefresh: true },
  });
  return {
    session,
    db: createDb(),
    recordClientCrash,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
