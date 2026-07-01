import type { Context as HonoContext } from "hono";

import { createAuth } from "@dirework/auth";
import { createDb } from "@dirework/db";

// Per-request factories — Workers isolate per request, no module singletons.
export async function createContext({ context }: { context: HonoContext }) {
  const session = await createAuth().api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
    db: createDb(),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
