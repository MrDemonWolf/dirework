// Outbound links on the viewer landing page (`/`), the claim page and the header's account
// menu. Pure, so the URL building is unit-tested; the server components pass in the web
// worker's DOCS_URL binding (packages/infra/alchemy.run.ts).

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
  /** GitHub's new-issue form: the account menu's "Report a problem". */
  reportProblem: string;
}

/** The account menu's outbound links, built by the (app) layout and passed down as a prop. */
export type AccountLinks = Pick<LandingLinks, "docs" | "reportProblem">;

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
    reportProblem: `${REPO_URL}/issues/new`,
  };
}
