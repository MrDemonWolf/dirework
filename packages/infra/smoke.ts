/**
 * Post-deploy smoke check, run by deploy.yml after Alchemy finishes
 * (smoke-check.ts). Four probes, each retried while the new workers propagate:
 *
 * - api `/ready` answers 200 with `limits: "ok"`: D1 is reachable AND all four
 *   rate-limit bindings attached. The limiter fails open, so a binding that did
 *   not bind would otherwise stay invisible until a flood — a fork's first
 *   deploy is where that bites.
 * - web `/api/version` reports the commit that was just deployed.
 * - web `/` renders: 200 after redirects, landing on `/` (claimed instance) or
 *   `/setup` (unclaimed), with the DireWork heading in the body. The page SSRs
 *   the session and the owner gate, so the server-rendered path (which the
 *   build-time smoke check cannot boot without an api) has to work end to end.
 *   Those helpers fail closed when the api is unreachable, so the api hop
 *   itself is proven by the next probe.
 * - web `/rpc/user.me` answers 401: the authenticated proxy reaches the api and
 *   `ownerProcedure` refuses an anonymous caller. A GET, because `user.me` is a
 *   query — tRPC rejects a POST to a query before auth gets to answer.
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

/** Where an anonymous GET of the web root may land: the landing page, or the claim page of an unclaimed instance. */
const HOME_PATHS = new Set(["/", "/setup"]);

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries until `accept` passes; returns the last failure reason otherwise. */
async function poll(
  url: string,
  accept: (response: Response) => Promise<string | null>,
  options: Required<Pick<SmokeCheckOptions, "fetchImpl" | "attempts" | "delayMs" | "timeoutMs">>,
  headers: Record<string, string> = {},
): Promise<string | null> {
  let failure = "no attempt made";
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const response = await options.fetchImpl(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { "cache-control": "no-cache", ...headers },
      });
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

/** Returns one message per failed probe; an empty array means healthy. */
export async function runSmokeCheck(options: SmokeCheckOptions): Promise<string[]> {
  const settings = {
    fetchImpl: options.fetchImpl ?? fetch,
    attempts: options.attempts ?? 6,
    delayMs: options.delayMs ?? 10_000,
    timeoutMs: options.timeoutMs ?? 10_000,
  };
  const errors: string[] = [];

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
  const home = await poll(
    homeUrl,
    async (response) => {
      if (!response.ok) return `status ${response.status}`;
      // fetch followed any redirect; `url` is where it ended up (empty on a
      // constructed Response, which means it went nowhere).
      const landed = new URL(response.url || homeUrl).pathname;
      if (!HOME_PATHS.has(landed)) return `landed on ${landed.slice(0, 80)}`;
      const html = await response.text().catch(() => "");
      return html.includes("DireWork") && html.includes("<h1")
        ? null
        : "no DireWork heading in the body";
    },
    settings,
  );
  if (home !== null) errors.push(`web / did not render (${home})`);

  const rpc = await poll(
    joinUrl(options.webUrl, "/rpc/user.me"),
    async (response) => (response.status === 401 ? null : `status ${response.status}`),
    settings,
    { accept: "application/json" },
  );
  if (rpc !== null) errors.push(`web /rpc/user.me did not answer 401 through the proxy (${rpc})`);

  return errors;
}
