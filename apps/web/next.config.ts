import "@dirework/env/web";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const { version } = createRequire(import.meta.url)("./package.json") as {
  version: string;
};

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

/**
 * Enforced Content Security Policy.
 *
 * Next currently needs inline hydration and style blocks, but production does
 * not need eval; keeping dynamic evaluation would turn otherwise-contained script
 * injection bugs into code execution. Token routes receive stricter cache,
 * referrer, and crawler headers below.
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Twitch profile images (better-auth stores the CDN URL on the session user).
  "img-src 'self' data: blob: https://static-cdn.jtvnw.net",
  "font-src 'self' data:",
  // Direct browser traffic: the api worker (publicTrpc for overlays + bot page)
  // and the Twitch IRC WebSocket the bot page owns.
  `connect-src 'self' ${serverUrl} wss://irc-ws.chat.twitch.tv`,
  // OAuth hops leave the page entirely, so they belong in form-action, not connect-src.
  "form-action 'self' https://id.twitch.tv",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const noStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
];

const tokenRouteHeaders = [
  ...noStoreHeaders,
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_APP_VERSION: version,
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
          { key: "Content-Security-Policy", value: cspDirectives },
        ],
      },
      { source: "/overlay/:path*", headers: tokenRouteHeaders },
      { source: "/bot/:path*", headers: tokenRouteHeaders },
      { source: "/rpc/:path*", headers: noStoreHeaders },
      { source: "/api/:path*", headers: noStoreHeaders },
      { source: "/dashboard/:path*", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
