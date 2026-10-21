/**
 * Post-deploy smoke check, run by deploy.yml after Alchemy finishes
 * (smoke-check.ts). Four probes, each retried while the new workers propagate:
 *
 * - api `/ready` answers 200 with `limits: "ok"`: D1 is reachable AND all four
 *   rate-limit bindings attached. The limiter fails open, so a binding that did
 *   not bind would otherwise stay invisible until a flood — a fork's first
 *   deploy is where that bites.
 * - web `/api/version` reports the commit that was just deployed.
 * - web `/` renders, redirects not followed: a claimed instance answers 200
 *   with the DireWork heading in the body; an unclaimed one redirects to
 *   `/setup`, which must then either render the claim page (200 + heading) or,
 *   when Cloudflare Access fronts `/setup`, answer with an Access login
 *   redirect. A redirect anywhere else fails. The page SSRs
 *   the session and the owner gate, so the server-rendered path (which the
 *   build-time smoke check cannot boot without an api) has to work end to end.
 *   Those helpers fail closed when the api is unreachable, so the api hop
 *   itself is proven by the next probe.
 * - web `/rpc/user.me` refuses an anonymous caller, one of two ways: 401, the
 *   authenticated proxy reached the api and `ownerProcedure` said no; or a
 *   302/303 to a Cloudflare Access login page, because the operator put Access
 *   in front of `/rpc/*` (an extra layer, never a replacement for the owner
 *   check). A GET, because `user.me` is a query — tRPC rejects a POST to a
 *   query before auth gets to answer. Redirects are not followed: following one
 *   lands on Access's own login page, a 200 that would read as "the proxy served
 *   an anonymous caller". A 200 still fails, and so does a redirect anywhere but
 *   Access. `/api/*` is never behind Access, so the api and version probes
 *   need no such case.
 *
 * Pure apart from the injected fetch, so the logic is unit-tested.
 */

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface SmokeCheckOptions {
  apiUrl: string;
  webUrl: string;
  /** Full commit SHA the deploy was built from (GITHUB_SHA). */
  expectedSha: string;
  fetchImpl?: Fetch;
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
}

export interface SmokeCheckResult {
  /** One message per failed probe; empty means healthy. */
  errors: string[];
  /** How probes with more than one passing answer passed, for the success log. */
  notes: string[];
}

/**
 * `git rev-parse --short` can return more than 7 characters when the short form
 * is ambiguous, so compare by prefix rather than slicing the expected SHA.
 */
export function deployedShaMatches(deployed: unknown, expectedSha: string): boolean {
  if (typeof deployed !== "string" || !/^[0-9a-f]{7,40}$/.test(deployed)) return false;
  return expectedSha.toLowerCase().startsWith(deployed);
}

/**
 * The `limits` field of `/ready` as a failure reason: null for "ok", the
 * missing-bindings list when the worker reported one, "unknown" for anything
 * else (a build that predates the field, or no JSON at all). The field is the
 * api's own closed vocabulary, so only that shape is echoed into the log.
 */
export function describeLimits(body: unknown): string | null {
  const limits = (body as { limits?: unknown } | null)?.limits;
  if (limits === "ok") return null;
  return typeof limits === "string" && /^missing:[A-Z_,]+$/.test(limits)
    ? `limits ${limits}`
    : "limits unknown";
}

/**
 * True when `location` (resolved against the request URL) is a Cloudflare Access
 * login page: https, a `*.cloudflareaccess.com` team domain on the default
 * port, path under `/cdn-cgi/access/login/`. Parsed with URL, so a look-alike
 * such as `cloudflareaccess.com.evil.example` or an `http:` downgrade fails.
 */
export function isAccessLoginRedirect(location: string | null, requestUrl: string): boolean {
  const target = resolveLocation(location, requestUrl);
  return (
    target !== null &&
    target.protocol === "https:" &&
    target.port === "" &&
    target.hostname.endsWith(".cloudflareaccess.com") &&
    target.pathname.startsWith("/cdn-cgi/access/login/")
  );
}

/** A `Location` header resolved against the request URL; null when absent or unparseable. */
function resolveLocation(location: string | null, requestUrl: string): URL | null {
  if (!location) return null;
  try {
    return new URL(location, requestUrl);
  } catch {
    return null;
  }
}

/** A 302/303 to a Cloudflare Access login page (`isAccessLoginRedirect`). */
function answersAccessLogin(response: Response, requestUrl: string): boolean {
  return (
    (response.status === 302 || response.status === 303) &&
    isAccessLoginRedirect(response.headers.get("location"), requestUrl)
  );
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** null when the page rendered (200 with the DireWork heading), the failure reason otherwise. */
async function renderedHeading(response: Response): Promise<string | null> {
  if (!response.ok) return `status ${response.status}`;
  const html = await response.text().catch(() => "");
  return html.includes("DireWork") && html.includes("<h1")
    ? null
    : "no DireWork heading in the body";
}

/** Where a redirect points, for a failure reason: the path on the same origin, host + path elsewhere. */
function describeRedirect(target: URL | null, requestUrl: string): string {
  if (target === null) return "redirect without a usable location";
  const where =
    target.origin === new URL(requestUrl).origin
      ? target.pathname
      : `${target.host}${target.pathname}`;
  return `landed on ${where.slice(0, 80)}`;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Settings = Required<
  Pick<SmokeCheckOptions, "fetchImpl" | "attempts" | "delayMs" | "timeoutMs">
>;

/** One probe request: uncached, time-boxed. */
function request(
  url: string,
  options: Settings,
  headers: Record<string, string> = {},
  init: Pick<RequestInit, "redirect"> = {},
): Promise<Response> {
  return options.fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(options.timeoutMs),
    headers: { "cache-control": "no-cache", ...headers },
  });
}

/** Retries until `accept` passes; returns the last failure reason otherwise. */
async function poll(
  url: string,
  accept: (response: Response) => Promise<string | null>,
  options: Settings,
  headers: Record<string, string> = {},
  init: Pick<RequestInit, "redirect"> = {},
): Promise<string | null> {
  let failure = "no attempt made";
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const response = await request(url, options, headers, init);
      const problem = await accept(response);
      if (problem === null) return null;
      failure = problem;
    } catch (error) {
      failure = error instanceof Error ? error.name : "request failed";
    }
    if (attempt < options.attempts) await sleep(options.delayMs);
  }
  return failure;
}

export async function runSmokeCheck(options: SmokeCheckOptions): Promise<SmokeCheckResult> {
  const settings = {
    fetchImpl: options.fetchImpl ?? fetch,
    attempts: options.attempts ?? 6,
    delayMs: options.delayMs ?? 10_000,
    timeoutMs: options.timeoutMs ?? 10_000,
  };
  const errors: string[] = [];
  const notes: string[] = [];

  const ready = await poll(
    joinUrl(options.apiUrl, "/ready"),
    async (response) => {
      if (!response.ok) return `status ${response.status}`;
      return describeLimits(await response.json().catch(() => null));
    },
    settings,
  );
  if (ready !== null) errors.push(`api /ready failed (${ready})`);

  const version = await poll(
    joinUrl(options.webUrl, "/api/version"),
    async (response) => {
      if (!response.ok) return `status ${response.status}`;
      const body = (await response.json().catch(() => null)) as { sha?: unknown } | null;
      return deployedShaMatches(body?.sha, options.expectedSha)
        ? null
        : `serving ${typeof body?.sha === "string" ? body.sha.slice(0, 40) : "unknown"}`;
    },
    settings,
  );
  if (version !== null) errors.push(`web /api/version is not the deployed commit (${version})`);

  const homeUrl = joinUrl(options.webUrl, "/");
  const setupUrl = joinUrl(options.webUrl, "/setup");
  let homePass = "";
  const home = await poll(
    homeUrl,
    async (response) => {
      if (!REDIRECT_STATUSES.has(response.status)) {
        const problem = await renderedHeading(response);
        homePass = "rendered the home page (claimed instance)";
        return problem;
      }
      // Unclaimed: `/` sends the visitor to the claim page. Any other redirect fails.
      const target = resolveLocation(response.headers.get("location"), homeUrl);
      if (target?.href !== setupUrl) return describeRedirect(target, homeUrl);

      const setup = await request(setupUrl, settings, {}, { redirect: "manual" });
      if (answersAccessLogin(setup, setupUrl)) {
        homePass = "redirected to /setup, protected by Cloudflare Access (unclaimed instance)";
        return null;
      }
      const problem = await renderedHeading(setup);
      homePass = "redirected to /setup and rendered the claim page (unclaimed instance)";
      return problem === null ? null : `/setup ${problem}`;
    },
    settings,
    {},
    { redirect: "manual" },
  );
  if (home === null) notes.push(`web / ${homePass}`);
  else errors.push(`web / did not render (${home})`);

  const rpcUrl = joinUrl(options.webUrl, "/rpc/user.me");
  let rpcPass = "";
  const rpc = await poll(
    rpcUrl,
    async (response) => {
      if (response.status === 401) {
        rpcPass = "answered 401 through the proxy";
        return null;
      }
      if (answersAccessLogin(response, rpcUrl)) {
        rpcPass = "protected by Cloudflare Access (login redirect)";
        return null;
      }
      return `status ${response.status}`;
    },
    settings,
    { accept: "application/json" },
    { redirect: "manual" },
  );
  if (rpc === null) notes.push(`web /rpc/user.me ${rpcPass}`);
  else errors.push(`web /rpc/user.me did not answer 401 through the proxy (${rpc})`);

  return { errors, notes };
}
