import type { NextRequest } from "next/server";

import { auth } from "@dirework/auth";
import prisma from "@dirework/db";

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    session,
    prisma,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
