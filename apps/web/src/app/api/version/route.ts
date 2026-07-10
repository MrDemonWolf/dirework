// Reports the commit SHA of the *currently deployed* web worker. An open
// dashboard tab holds the SHA baked into its JS at load time; polling this and
// finding a different SHA means a newer deploy is live and the tab is stale.
// force-dynamic + no-store so it always reflects the running worker, not a
// cached response from the previous deploy.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { sha: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
