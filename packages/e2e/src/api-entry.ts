// The api worker's e2e entry: the real app (apps/server/src/index.ts), unchanged, plus
// test-only knobs that production never has: an artificial delay on named tRPC procedures, a
// request tally, a fake connected bot account (`/__e2e/bot-account`, below), and a reset of
// the bot page lease (`/__e2e/bot-lease`).
//
// A spec sets the `e2e-delay` cookie on the web origin (`task.list=1500,timer.get=800`). The
// web worker's server render forwards the browser's cookie on its batched call straight to
// the api, so the delay reaches exactly the procedures a page prefetches, and nothing else
// changes: one request, the same batch. It is how the progressive-dashboard specs prove that
// a slow procedure holds back only its own section. A server call that forwards no cookie
// (the landing's and claim page's `user.hasOwner` check) is slowed through `/__e2e/delay`
// instead, which applies the same list to every request until it is cleared.
//
// The delay lives here, not in the app: every procedure of the router is wrapped once at
// module load, and the delays are read per request through AsyncLocalStorage. Without the
// cookie or `/__e2e/delay` the wrapper is a pass-through.

import { AsyncLocalStorage } from "node:async_hooks";

import { appRouter } from "@dirework/api/routers/index";

import app from "../../../apps/server/src/index";
import { DELAY_COOKIE } from "./env";

const requestDelays = new AsyncLocalStorage<ReadonlyMap<string, number>>();

/** `task.list=1500,timer.get=800` → path → milliseconds (bad entries are ignored). */
function parseDelays(list: string): Map<string, number> {
  const delays = new Map<string, number>();
  for (const entry of list.split(",")) {
    const [path, ms] = entry.split("=");
    const value = Number(ms);
    if (path && Number.isFinite(value) && value > 0) delays.set(path, Math.min(value, 10_000));
  }
  return delays;
}

/** The delays a request's `e2e-delay` cookie names. */
function cookieDelays(cookieHeader: string | null): Map<string, number> {
  const raw = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DELAY_COOKIE}=`))
    ?.slice(DELAY_COOKIE.length + 1);
  return parseDelays(decodeURIComponent(raw ?? ""));
}

/**
 * Delays for every request, cookie or not: `PUT /__e2e/delay` with the cookie's list as the
 * body sets them, `DELETE` clears them (`setApiDelay` in tests/helpers.ts). A request's own
 * cookie wins for the procedures it names. A spec that sets them clears them again, since
 * they outlive the test.
 */
let sharedDelays: ReadonlyMap<string, number> = new Map();

async function setSharedDelays(request: Request): Promise<Response> {
  if (request.method === "PUT") {
    sharedDelays = parseDelays(await request.text());
  } else if (request.method === "DELETE") {
    sharedDelays = new Map();
  } else {
    return new Response(null, { status: 405 });
  }
  return new Response(null, { status: 204 });
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

interface E2eEnv {
  DB: {
    prepare(sql: string): { run(): Promise<unknown> };
  };
}

/**
 * `POST /__e2e/bot-account` gives the instance a (fake) connected bot account, `DELETE`
 * removes it, so a spec can render the screens that only exist once a bot is connected (the
 * bot page handoff). The tokens are never used: nothing in those specs talks to Twitch. A
 * spec that seeds it removes it again, since later specs expect no bot account.
 */
async function seedBotAccount(request: Request, env: E2eEnv): Promise<Response> {
  if (request.method === "POST") {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO bot_account (id, twitch_id, username, display_name, access_token, refresh_token, expires_at)
       VALUES ('singleton', '2000', 'direbot', 'DireBot', 'e2e-access', 'e2e-refresh', ${Date.now() + 3_600_000})`,
    ).run();
  } else if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM bot_account").run();
  } else {
    return new Response(null, { status: 405 });
  }
  return new Response(null, { status: 204 });
}

/**
 * `DELETE /__e2e/bot-lease` frees the one-bot-page chat lease, so a spec that opens bot pages
 * starts from "no page running" even when a page from an earlier attempt still holds it
 * (a lease outlives its page by up to 5 minutes when the release on close doesn't land).
 */
async function clearBotLease(request: Request, env: E2eEnv): Promise<Response> {
  if (request.method !== "DELETE") return new Response(null, { status: 405 });
  await env.DB.prepare(
    "UPDATE instance_config SET bot_lease_instance_id = NULL, bot_lease_seen_at = NULL",
  ).run();
  return new Response(null, { status: 204 });
}

export default {
  fetch(request: Request, env: unknown, ctx: unknown) {
    const { pathname } = new URL(request.url);
    if (pathname === "/__e2e/requests") {
      const body = JSON.stringify(served);
      served = {};
      return new Response(body, { headers: { "content-type": "application/json" } });
    }
    if (pathname === "/__e2e/bot-account") return seedBotAccount(request, env as E2eEnv);
    if (pathname === "/__e2e/bot-lease") return clearBotLease(request, env as E2eEnv);
    if (pathname === "/__e2e/delay") return setSharedDelays(request);
    const key = pathname;
    served[key] = (served[key] ?? 0) + 1;
    const delays = new Map([...sharedDelays, ...cookieDelays(request.headers.get("cookie"))]);
    return requestDelays.run(delays, () => app.fetch(request, env as never, ctx as never));
  },
};
