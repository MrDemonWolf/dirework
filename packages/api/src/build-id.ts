/**
 * The api worker's build id on the wire. Every api response carries the commit the worker was
 * deployed from (`x-dirework-build`, apps/server's build-id middleware), so a long-lived token
 * page (an OBS overlay, the bot widget or dock) can tell from the answers it already gets that
 * a deploy happened and reload itself once (apps/web/src/lib/deploy-reload.ts).
 *
 * Zod-free and env-free: shared by apps/server and the browser bundle.
 */

/** The response header the build id travels in. CORS exposes it to the web origin. */
export const BUILD_ID_HEADER = "x-dirework-build";

/** A git commit sha, short or full: the only shape a build id can take. */
const BUILD_ID_PATTERN = /^[0-9a-f]{7,40}$/;

/** A real build id; "dev", empty or anything else turns the reload off. */
export function isBuildId(value: string | null | undefined): value is string {
  return typeof value === "string" && BUILD_ID_PATTERN.test(value);
}
