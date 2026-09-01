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
 * Content Security Policy — **enforcing**.
 *
 * Shipped Report-Only first (P2.16) because overlays run inside OBS browser
 * sources and the bot page holds a Twitch IRC WebSocket, so a wrong policy takes
 * a live stream down. That wait produced no signal (the header carried no
 * `report-uri`/`report-to`, so nothing was ever collected) and it hid one real
 * violation: the overlay route group used to `<link>` a fonts.googleapis.com
 * stylesheet. That link was dead weight — the root layout already serves every
 * overlay family self-hosted from /fonts/fonts.css — so it was deleted rather
 * than allowlisted, and the policy below is now enforced.
 *
 * Every directive is pinned to an actual usage: static-cdn.jtvnw.net is the
 * Twitch avatar better-auth stores on the session user, id.twitch.tv is the
 * OAuth form post, irc-ws.chat.twitch.tv is the bot page's IRC socket, and
 * ${serverUrl} is publicTrpc's direct hop to the api worker. Adding an external
 * origin to an overlay means editing this list — see the drift test in
 * src/lib/__tests__/csp.test.ts.
 *
 * `unsafe-inline`/`unsafe-eval` on script-src are required by Next's hydration
 * bootstrap without a nonce; tightening those needs nonce-based CSP via
 * middleware, which is the natural follow-up now that this enforces.
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
].join("; ");

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
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
    ];
  },
};

export default nextConfig;
