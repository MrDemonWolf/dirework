/**
 * Post-deploy smoke check: the api worker reaches D1 (`/ready`) and the web
 * worker serves the commit that was just deployed (`/api/version`). Pure apart
 * from the injected fetch, so the logic is unit-tested.
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

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries until `accept` passes; returns the last failure reason otherwise. */
async function poll(
  url: string,
  accept: (response: Response) => Promise<string | null>,
  options: Required<Pick<SmokeCheckOptions, "fetchImpl" | "attempts" | "delayMs" | "timeoutMs">>,
): Promise<string | null> {
  let failure = "no attempt made";
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const response = await options.fetchImpl(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { "cache-control": "no-cache" },
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
    async (response) => (response.ok ? null : `status ${response.status}`),
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

  return errors;
}
