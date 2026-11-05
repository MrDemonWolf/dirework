// Long-lived token pages (the OBS overlays, the bot widget and dock) stay open for a whole
// stream, often across deploys, so they can keep running a build the api no longer matches.
// Each one reloads itself once, at a safe moment, after a deploy:
//
// 1. The api worker stamps its build id on every response (`x-dirework-build`, apps/server's
//    build-id middleware). `publicTrpc`'s fetch hands each response to `noteResponse`: no new
//    request, and nothing at all while the ids match.
// 2. When a page's own build (NEXT_PUBLIC_COMMIT_SHA) differs, it asks `/version.json` (a free
//    static asset) whether the web worker serves that build yet: Alchemy deploys the api first
//    and builds the web worker after it, so a reload in between would only fetch the old page.
//    At most once per DEPLOY_CONFIRM_MIN_MS, and only while the ids differ.
// 3. Once it does, the page reloads, but only when its caller says it is safe (the bot between
//    commands, the timer overlay off a running countdown), and records the build in
//    sessionStorage, so a page that somehow reloads into the old build again never loops.
//
// React-free, so it is unit-tested with injected clocks and storage.

import { BUILD_ID_HEADER } from "@dirework/api/build-id";

import { DEPLOY_CONFIRM_MIN_MS } from "./poll-intervals";
import { isStale } from "./version";
import { fetchDeployedSha } from "./version-check";

/** sessionStorage key: the api build this tab already reloaded for. */
export const RELOADED_FOR_KEY = "dirework.reloaded-for-build";

export { DEPLOY_CONFIRM_MIN_MS };

type BuildStorage = Pick<Storage, "getItem" | "setItem">;

export interface DeployReloaderOptions {
  /** The build this page was served from; "dev" or empty turns reloading off. */
  ownBuild: string | undefined;
  /** The build the web worker's static assets serve now (undefined when the check fails). */
  fetchDeployedBuild?: () => Promise<string | undefined>;
  /** Where the loop guard lives; null (blocked storage) turns reloading off. */
  storage: BuildStorage | null;
  reload?: () => void;
  now?: () => number;
}

export interface DeployReloader {
  /** Remember the build id an api response carried. */
  noteResponse(response: Response): void;
  /**
   * Reload when the api runs a newer build that the web worker serves too, and `isSafe()`
   * holds both before and after the static check. True when it reloaded.
   */
  check(isSafe: () => boolean): Promise<boolean>;
}

export function createDeployReloader({
  ownBuild,
  fetchDeployedBuild = fetchDeployedSha,
  storage,
  reload = () => window.location.reload(),
  now = Date.now,
}: DeployReloaderOptions): DeployReloader {
  let apiBuild: string | null = null;
  let lastConfirmAt = Number.NEGATIVE_INFINITY;
  let confirming = false;
  let reloaded = false;

  const read = (): string | null => {
    try {
      return storage?.getItem(RELOADED_FOR_KEY) ?? null;
    } catch {
      return null;
    }
  };

  return {
    noteResponse(response) {
      const build = response.headers.get(BUILD_ID_HEADER);
      if (build) apiBuild = build;
    },
    async check(isSafe) {
      const target = apiBuild;
      if (reloaded || confirming || !storage || !target || !isStale(ownBuild, target)) {
        return false;
      }
      if (read() === target || now() - lastConfirmAt < DEPLOY_CONFIRM_MIN_MS || !isSafe()) {
        return false;
      }
      lastConfirmAt = now();
      confirming = true;
      const live = await fetchDeployedBuild().catch(() => undefined);
      confirming = false;
      if (reloaded || live !== target || !isSafe()) return false;
      try {
        storage.setItem(RELOADED_FOR_KEY, target);
      } catch {
        // Without the guard a reload could repeat; stay on this build instead.
        return false;
      }
      reloaded = true;
      reload();
      return true;
    },
  };
}

function sessionStore(): BuildStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The page's reloader, created on first use in the browser (null on the server, which renders
 * these pages but never fetches through publicTrpc). One per page load, like `pageLeaseId`.
 */
let browserReloader: DeployReloader | undefined;
export function deployReloader(): DeployReloader | null {
  if (typeof window === "undefined") return null;
  browserReloader ??= createDeployReloader({
    ownBuild: process.env.NEXT_PUBLIC_COMMIT_SHA,
    storage: sessionStore(),
  });
  return browserReloader;
}
