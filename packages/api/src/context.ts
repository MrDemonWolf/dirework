import type { NextRequest } from "next/server";

import { auth } from "@dirework/auth";
import { db } from "@dirework/db";

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    session,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
