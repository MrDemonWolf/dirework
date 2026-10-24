// The api worker's e2e entry: the real app (apps/server/src/index.ts), unchanged, plus one
// test-only knob that production never has — an artificial delay on named tRPC procedures.
//
// A spec sets the `e2e-delay` cookie on the web origin (`task.list=1500,timer.get=800`). The
// web worker's server render forwards the browser's cookie on its batched call straight to
// the api, so the delay reaches exactly the procedures a page prefetches, and nothing else
// changes: one request, the same batch. It is how the progressive-dashboard specs prove that
// a slow procedure holds back only its own section.
//
// The delay lives here, not in the app: every procedure of the router is wrapped once at
// module load, and the cookie is read per request through AsyncLocalStorage. Without the
// cookie the wrapper is a pass-through.

import { AsyncLocalStorage } from "node:async_hooks";

import { appRouter } from "@dirework/api/routers/index";

import app from "../../../apps/server/src/index";
import { DELAY_COOKIE } from "./env";

const requestDelays = new AsyncLocalStorage<ReadonlyMap<string, number>>();

/** `task.list=1500,timer.get=800` → path → milliseconds (bad entries are ignored). */
function parseDelays(cookieHeader: string | null): ReadonlyMap<string, number> {
  const delays = new Map<string, number>();
  const raw = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DELAY_COOKIE}=`))
    ?.slice(DELAY_COOKIE.length + 1);
  for (const entry of decodeURIComponent(raw ?? "").split(",")) {
    const [path, ms] = entry.split("=");
    const value = Number(ms);
    if (path && Number.isFinite(value) && value > 0) delays.set(path, Math.min(value, 10_000));
  }
  return delays;
}

type Procedure = ((opts: unknown) => Promise<unknown>) & Record<string, unknown>;
const procedures = (appRouter as unknown as { _def: { procedures: Record<string, Procedure> } })
  ._def.procedures;
for (const [path, procedure] of Object.entries(procedures)) {
  const delayed = async (opts: unknown) => {
    const ms = requestDelays.getStore()?.get(path);
    if (ms) await new Promise((resolve) => setTimeout(resolve, ms));
    return procedure(opts);
  };
  // Keep `_def` and friends, so tRPC still recognises it as the same procedure.
  procedures[path] = Object.assign(delayed, procedure);
}

/**
 * Requests served since the last read, by path (`/trpc/user.me,timer.get` → `/trpc`), so a
 * spec can count what one page load cost the api worker. `GET /__e2e/requests` returns the
 * tally and resets it.
 */
let served: Record<string, number> = {};

export default {
  fetch(request: Request, env: unknown, ctx: unknown) {
    const { pathname } = new URL(request.url);
    if (pathname === "/__e2e/requests") {
      const body = JSON.stringify(served);
      served = {};
      return new Response(body, { headers: { "content-type": "application/json" } });
    }
    const key = pathname;
    served[key] = (served[key] ?? 0) + 1;
    return requestDelays.run(parseDelays(request.headers.get("cookie")), () =>
      app.fetch(request, env as never, ctx as never),
    );
  },
};
