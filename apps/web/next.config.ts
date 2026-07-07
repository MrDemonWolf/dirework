import "@dirework/env/web";
import { execSync } from "node:child_process";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Enables `getCloudflareContext()` / worker bindings during `next dev`.
initOpenNextCloudflareForDev();

// API worker origin. workers.dev is on the Public Suffix List, so cookies can
// never span the web + api workers — authenticated traffic must be proxied
// same-origin. Falls back to localhost so plain `next dev` works without a
// deployed api worker.
// `||` not `??`: an empty NEXT_PUBLIC_SERVER_URL (unset GH deploy var) would
// slip past `??` and make every rewrite target relative -> self-proxy 404s.
const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

const commitSha = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
  },
  async rewrites() {
    return [
      // Protected tRPC — browser calls same-origin /rpc/* with cookies,
      // the web worker proxies to the api worker's /trpc/*. tRPC never
      // redirects, so a rewrite is safe here. The OAuth routes (/api/auth/*,
      // /api/bot/*) are NOT rewrites: rewrites follow upstream 3xx and drop
      // their Set-Cookie — they're proxied by route handlers instead
      // (src/app/api/{auth,bot}/**/route.ts via lib/auth-proxy.ts).
      { source: "/rpc/:path*", destination: `${serverUrl}/trpc/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
