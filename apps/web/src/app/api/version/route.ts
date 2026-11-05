// Reports the *currently deployed* web worker's commit for smoke and uptime
// checks. Owner tabs use the free static /version.json asset for their polling.
// force-dynamic + no-store keeps this probe tied to the running worker.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { sha: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
