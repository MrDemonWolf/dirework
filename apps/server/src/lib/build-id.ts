import { BUILD_ID_HEADER, isBuildId } from "@dirework/api/build-id";
import type { MiddlewareHandler } from "hono";

/**
 * Stamps this worker's build id (the deploy's git sha, the `BUILD_ID` binding) on every
 * response, so a long-lived token page notices a deploy from the answers it already gets: no
 * extra request. Nothing is sent when the binding is missing or isn't a sha (local dev without
 * git, the e2e worker), which leaves the pages' reload off.
 */
export function buildIdHeader(buildId: string | undefined): MiddlewareHandler {
  const id = isBuildId(buildId) ? buildId : null;
  return async (c, next) => {
    await next();
    if (id) c.header(BUILD_ID_HEADER, id);
  };
}
