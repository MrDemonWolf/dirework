// Outbound links on the viewer landing page (`/`). Pure, so the URL building is unit-tested;
// the page passes in the web worker's DOCS_URL binding (packages/infra/alchemy.run.ts).

/** The public docs site, used when the operator leaves DOCS_URL unset (same as the api worker). */
export const DEFAULT_DOCS_URL = "https://dirework.mrdemonwolf.dev";

export const REPO_URL = "https://github.com/mrdemonwolf/dirework";

/** MrDemonWolf's Discord — the README's Contact channel. */
export const SUPPORT_URL = "https://mrdwolf.net/discord";

export interface LandingLinks {
  docs: string;
  deployGuide: string;
  repo: string;
  license: string;
  releases: string;
  support: string;
}

/** Build every landing link from the configured docs origin ("" or unset → the public docs). */
export function landingLinks(docsUrl: string | undefined): LandingLinks {
  const docsOrigin = (docsUrl?.trim() || DEFAULT_DOCS_URL).replace(/\/+$/, "");
  return {
    docs: `${docsOrigin}/docs`,
    deployGuide: `${docsOrigin}/docs/deployment`,
    repo: REPO_URL,
    license: `${REPO_URL}/blob/main/LICENSE`,
    releases: `${REPO_URL}/releases`,
    support: SUPPORT_URL,
  };
}
