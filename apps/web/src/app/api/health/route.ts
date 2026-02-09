import packageJson from "../../../../package.json";

export function GET() {
  return Response.json({
    status: "ok",
    uptime: process.uptime(),
    version: packageJson.version,
    timestamp: new Date().toISOString(),
  });
}
