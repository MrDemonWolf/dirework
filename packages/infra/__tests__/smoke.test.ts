import { describe, expect, it } from "vitest";

import { deployedShaMatches, describeLimits, isAccessLoginRedirect, runSmokeCheck } from "../smoke";

const fullSha = "0123456789abcdef0123456789abcdef01234567";

type Route = (attempt: number) => Response | Error;

function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const headers: Record<string, Record<string, string>> = {};
  const redirects: Record<string, RequestInit["redirect"]> = {};
  const counts = new Map<string, number>();
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push(url);
    headers[url] = Object.fromEntries(new Headers(init?.headers));
    redirects[url] = init?.redirect;
    const attempt = (counts.get(url) ?? 0) + 1;
    counts.set(url, attempt);
    const route = routes[url];
    if (!route) throw new Error(`unexpected url ${url}`);
    const result = route(attempt);
    if (result instanceof Error) throw result;
    return result;
  };
  return { fetchImpl, calls, headers, redirects };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** An HTML page. */
function html(body: string, { status = 200 }: { status?: number } = {}) {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

const landingPage =
  "<!doctype html><html><head><title>DireWork</title></head><body><h1>Focus with your chat</h1></body></html>";
const claimPage =
  "<!doctype html><html><head><title>Setup | DireWork</title></head><body><h1>Claim this instance</h1></body></html>";

const API = "https://api.example.com";
const WEB = "https://web.example.com";
const READY = `${API}/ready`;
const VERSION = `${WEB}/api/version`;
const HOME = `${WEB}/`;
const SETUP = `${WEB}/setup`;
const RPC = `${WEB}/rpc/user.me`;

/** Every probe answering the way a healthy, claimed instance does. */
const healthy = (): Record<string, Route> => ({
  [READY]: () => json({ status: "ready", db: "ok", limits: "ok" }),
  [VERSION]: () => json({ sha: "0123456" }),
  [HOME]: () => html(landingPage),
  [RPC]: () => json({ error: { message: "UNAUTHORIZED" } }, 401),
});

const options = { attempts: 3, delayMs: 0, timeoutMs: 1000 };

function run(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  return runSmokeCheck({
    apiUrl: `${API}/`,
    webUrl: WEB,
    expectedSha: fullSha,
    fetchImpl,
    ...options,
  });
}

/** Just the failures, which is what most cases assert on. */
async function check(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  return (await run(fetchImpl)).errors;
}

/** An unfollowed redirect, as fetch returns it under `redirect: "manual"`. */
const redirect = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } });

const ACCESS_LOGIN =
  "https://team.cloudflareaccess.com/cdn-cgi/access/login/web.example.com?kid=abc&redirect_url=%2Frpc%2Fuser.me";

describe("deployedShaMatches", () => {
  it("accepts a short SHA of any unambiguous length that prefixes the commit", () => {
    expect(deployedShaMatches("0123456", fullSha)).toBe(true);
    expect(deployedShaMatches("0123456789", fullSha)).toBe(true);
    expect(deployedShaMatches(fullSha, fullSha)).toBe(true);
  });

  it("rejects the dev fallback, other commits, and malformed values", () => {
    expect(deployedShaMatches("dev", fullSha)).toBe(false);
    expect(deployedShaMatches("abcdef0", fullSha)).toBe(false);
    expect(deployedShaMatches("012", fullSha)).toBe(false);
    expect(deployedShaMatches("", fullSha)).toBe(false);
    expect(deployedShaMatches(undefined, fullSha)).toBe(false);
    expect(deployedShaMatches(1234567, fullSha)).toBe(false);
  });
});

describe("describeLimits", () => {
  it("passes only an explicit ok and echoes the api's own missing-bindings list", () => {
    expect(describeLimits({ status: "ready", db: "ok", limits: "ok" })).toBeNull();
    expect(describeLimits({ limits: "missing:RL_AUTH,RL_OVERLAY" })).toBe(
      "limits missing:RL_AUTH,RL_OVERLAY",
    );
  });

  it("treats a worker without the field, or with an unexpected value, as unknown rather than ok", () => {
    expect(describeLimits({ status: "ready", db: "ok" })).toBe("limits unknown");
    expect(describeLimits(null)).toBe("limits unknown");
    expect(describeLimits({ limits: "<script>alert(1)</script>" })).toBe("limits unknown");
  });
});

describe("runSmokeCheck", () => {
  it("passes when the api is ready, the web worker serves the deployed commit, the home page renders and the proxy answers", async () => {
    const { fetchImpl, calls, headers, redirects } = fakeFetch(healthy());

    expect(await run(fetchImpl)).toEqual({
      errors: [],
      notes: [
        "web / rendered the home page (claimed instance)",
        "web /rpc/user.me answered 401 through the proxy",
      ],
    });
    expect(calls).toEqual([READY, VERSION, HOME, RPC]);
    // A followed redirect would hide where `/` sent the visitor.
    expect(redirects[HOME]).toBe("manual");
    // user.me is a query: a GET, asking for JSON so a stray HTML page can't pass for tRPC's answer.
    expect(headers[RPC]).toMatchObject({ accept: "application/json" });
    // Following a redirect would land on Access's login page (a 200) and hide the real answer.
    expect(redirects[RPC]).toBe("manual");
  });

  it("retries until a newly deployed worker starts answering", async () => {
    const { fetchImpl, calls } = fakeFetch({
      ...healthy(),
      [READY]: (attempt) =>
        attempt < 3
          ? new TypeError("fetch failed")
          : json({ status: "ready", db: "ok", limits: "ok" }),
      [VERSION]: (attempt) => json({ sha: attempt === 1 ? "fedcba9" : "0123456" }),
    });

    expect(await check(fetchImpl)).toEqual([]);
    expect(calls).toHaveLength(7);
  });

  it("reports a degraded api and a stale web worker after exhausting retries", async () => {
    const { fetchImpl, calls } = fakeFetch({
      ...healthy(),
      [READY]: () => json({ status: "degraded", db: "unreachable", limits: "ok" }, 503),
      [VERSION]: () => json({ sha: "dev" }),
    });

    expect(await check(fetchImpl)).toEqual([
      "api /ready failed (status 503)",
      "web /api/version is not the deployed commit (serving dev)",
    ]);
    expect(calls).toHaveLength(8);
  });

  it("reports network errors by name only and non-JSON version bodies as unknown", async () => {
    const { fetchImpl } = fakeFetch({
      ...healthy(),
      [READY]: () => new TypeError("fetch failed: https://secret"),
      [VERSION]: () => new Response("<html>", { status: 200 }),
    });

    expect(await check(fetchImpl)).toEqual([
      "api /ready failed (TypeError)",
      "web /api/version is not the deployed commit (serving unknown)",
    ]);
  });

  it("fails a ready api whose rate-limit bindings did not attach, naming them", async () => {
    // The limiter fails open, so /ready stays 200 — this check is the only place a
    // fork's first deploy learns its RateLimit resources did not bind.
    const { fetchImpl } = fakeFetch({
      ...healthy(),
      [READY]: () =>
        json({ status: "ready", db: "ok", limits: "missing:RL_AUTH,RL_BOT,RL_TOKEN,RL_OVERLAY" }),
    });

    expect(await check(fetchImpl)).toEqual([
      "api /ready failed (limits missing:RL_AUTH,RL_BOT,RL_TOKEN,RL_OVERLAY)",
    ]);
  });

  it("fails a ready api from a build that does not report limits at all", async () => {
    const { fetchImpl } = fakeFetch({
      ...healthy(),
      [READY]: () => json({ status: "ready", db: "ok" }),
    });

    expect(await check(fetchImpl)).toEqual(["api /ready failed (limits unknown)"]);
  });

  it("treats a ready probe whose body is not JSON as a build that reports no limits", async () => {
    const { fetchImpl } = fakeFetch({
      ...healthy(),
      [READY]: () => new Response("ready", { status: 200 }),
    });

    const errors = await check(fetchImpl);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^api \/ready failed \(/);
  });

  it("fails the home probe when the body cannot be read", async () => {
    const unreadable = () => {
      const response = html(landingPage);
      Object.defineProperty(response, "text", { value: () => Promise.reject(new Error("cut")) });
      return response;
    };
    const { fetchImpl } = fakeFetch({ ...healthy(), [HOME]: unreadable });

    expect(await check(fetchImpl)).toEqual([
      "web / did not render (no DireWork heading in the body)",
    ]);
  });

  it.each([
    ["relative", "/setup", 307],
    ["absolute", SETUP, 302],
  ])(
    "accepts an unclaimed instance redirecting / to /setup (%s) and rendering the claim page",
    async (_label, location, status) => {
      const { fetchImpl, calls, redirects } = fakeFetch({
        ...healthy(),
        [HOME]: () => redirect(location, status),
        [SETUP]: () => html(claimPage),
      });

      expect(await run(fetchImpl)).toEqual({
        errors: [],
        notes: [
          "web / redirected to /setup and rendered the claim page (unclaimed instance)",
          "web /rpc/user.me answered 401 through the proxy",
        ],
      });
      expect(calls).toEqual([READY, VERSION, HOME, SETUP, RPC]);
      expect(redirects[SETUP]).toBe("manual");
    },
  );

  it("accepts an unclaimed instance whose /setup is behind Cloudflare Access", async () => {
    const { fetchImpl } = fakeFetch({
      ...healthy(),
      [HOME]: () => redirect("/setup", 307),
      [SETUP]: () => redirect(ACCESS_LOGIN),
      [RPC]: () => redirect(ACCESS_LOGIN),
    });

    expect(await run(fetchImpl)).toEqual({
      errors: [],
      notes: [
        "web / redirected to /setup, protected by Cloudflare Access (unclaimed instance)",
        "web /rpc/user.me protected by Cloudflare Access (login redirect)",
      ],
    });
  });

  it.each([
    ["errors", () => html("<pre>DireWork</pre>", { status: 500 }), "/setup status 500"],
    [
      "renders without the heading",
      () => html("<html></html>"),
      "/setup no DireWork heading in the body",
    ],
    [
      "redirects to a look-alike Access host",
      () => redirect("https://team.cloudflareaccess.com.evil.example/cdn-cgi/access/login/x"),
      "/setup status 302",
    ],
    ["redirects anywhere else", () => redirect("/dashboard"), "/setup status 302"],
  ])("fails an unclaimed instance whose /setup %s", async (_label, route, reason) => {
    const { fetchImpl } = fakeFetch({
      ...healthy(),
      [HOME]: () => redirect("/setup", 307),
      [SETUP]: route,
    });

    expect(await check(fetchImpl)).toEqual([`web / did not render (${reason})`]);
  });

  it.each([
    ["errors", () => html("<h1>DireWork hit an error</h1>", { status: 500 }), "status 500"],
    ["redirects anywhere else", () => redirect("/dashboard", 307), "landed on /dashboard"],
    [
      "redirects to another host's /setup",
      () => redirect("https://evil.example/setup"),
      "landed on evil.example/setup",
    ],
    [
      "redirects straight to Access",
      () => redirect(ACCESS_LOGIN),
      "landed on team.cloudflareaccess.com/cdn-cgi/access/login/web.example.com",
    ],
    [
      "redirects without a location",
      () => new Response(null, { status: 308 }),
      "redirect without a usable location",
    ],
    [
      "redirects to an unparseable location",
      () => redirect("http://[bad"),
      "redirect without a usable location",
    ],
    [
      "renders without the heading",
      () => html("<html><body>Internal Server Error</body></html>"),
      "no DireWork heading in the body",
    ],
  ])("fails when the home page %s", async (_label, route, reason) => {
    const { fetchImpl } = fakeFetch({ ...healthy(), [HOME]: route });

    expect(await check(fetchImpl)).toEqual([`web / did not render (${reason})`]);
  });

  it.each([
    ["lets an anonymous caller through", 200],
    ["cannot reach the api", 502],
    ["is not routed", 404],
  ])("fails when the authenticated proxy %s", async (_label, status) => {
    const { fetchImpl } = fakeFetch({ ...healthy(), [RPC]: () => json({}, status) });

    expect(await check(fetchImpl)).toEqual([
      `web /rpc/user.me did not answer 401 through the proxy (status ${status})`,
    ]);
  });

  it.each([302, 303])(
    "passes when Cloudflare Access fronts /rpc and answers %i to its login page",
    async (status) => {
      const { fetchImpl } = fakeFetch({
        ...healthy(),
        [RPC]: () => redirect(ACCESS_LOGIN, status),
      });

      expect(await run(fetchImpl)).toEqual({
        errors: [],
        notes: [
          "web / rendered the home page (claimed instance)",
          "web /rpc/user.me protected by Cloudflare Access (login redirect)",
        ],
      });
    },
  );

  it.each([
    ["another host", "https://evil.example/cdn-cgi/access/login/web.example.com"],
    [
      "a look-alike host",
      "https://team.cloudflareaccess.com.evil.example/cdn-cgi/access/login/web.example.com",
    ],
    ["an http: downgrade", "http://team.cloudflareaccess.com/cdn-cgi/access/login/web.example.com"],
    ["another Access path", "https://team.cloudflareaccess.com/cdn-cgi/access/logout"],
    ["the same origin", "/dashboard"],
  ])("fails when /rpc redirects to %s", async (_label, location) => {
    const { fetchImpl } = fakeFetch({ ...healthy(), [RPC]: () => redirect(location) });

    expect(await check(fetchImpl)).toEqual([
      "web /rpc/user.me did not answer 401 through the proxy (status 302)",
    ]);
  });

  it("fails an Access login URL served with a non-redirect status", async () => {
    const { fetchImpl } = fakeFetch({ ...healthy(), [RPC]: () => redirect(ACCESS_LOGIN, 200) });

    expect(await check(fetchImpl)).toEqual([
      "web /rpc/user.me did not answer 401 through the proxy (status 200)",
    ]);
  });
});

describe("isAccessLoginRedirect", () => {
  it("accepts an absolute Access login URL on a team domain", () => {
    expect(isAccessLoginRedirect(ACCESS_LOGIN, RPC)).toBe(true);
  });

  it("rejects a missing, unparseable, non-default-port or bare-apex location", () => {
    expect(isAccessLoginRedirect(null, RPC)).toBe(false);
    expect(isAccessLoginRedirect("", RPC)).toBe(false);
    expect(isAccessLoginRedirect("https://", RPC)).toBe(false);
    expect(
      isAccessLoginRedirect("https://team.cloudflareaccess.com:8443/cdn-cgi/access/login/x", RPC),
    ).toBe(false);
    expect(isAccessLoginRedirect("https://cloudflareaccess.com/cdn-cgi/access/login/x", RPC)).toBe(
      false,
    );
  });
});
