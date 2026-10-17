// Site-wide footer for the docs + marketing site, rendered once by the root layout.
// The copyright line follows the repo's footer convention (AGENTS.md "Footer Convention"),
// shared with the web app's footer in apps/web/src/app/(app)/layout.tsx.

import Link from "next/link";
import { BrandMark } from "@/lib/layout.shared";

/** Footer nav columns: `[label, href]` pairs. External URLs go through next/link too. */
const groups = [
  {
    title: "Product",
    links: [
      ["Features", "/docs/features"],
      ["Overlays & themes", "/docs/overlays"],
      ["Chat commands", "/docs/chat-commands"],
    ],
  },
  {
    title: "Get started",
    links: [
      ["Getting started", "/docs/getting-started"],
      ["Deployment", "/docs/deployment"],
      ["Twitch setup", "/docs/twitch-oauth"],
    ],
  },
  {
    title: "Community",
    links: [
      ["GitHub", "https://github.com/mrdemonwolf/dirework"],
      ["Discord", "https://mrdwolf.net/discord"],
      ["Troubleshooting", "/docs/troubleshooting"],
    ],
  },
];

/** Brand blurb, link columns, copyright and legal links. */
export function Footer() {
  // Evaluated at build time in the static export, so the year updates on the next deploy.
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-fd-border bg-fd-card text-sm text-fd-muted-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr] md:gap-16">
          <div>
            <Link
              href="/"
              aria-label="DireWork home"
              className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fd-primary"
            >
              <BrandMark />
            </Link>
            <p className="mt-5 max-w-xs text-base leading-relaxed">
              Self-hosted focus tools for your Twitch stream. Pomodoro timers, viewer tasks, and OBS
              overlays on your own Cloudflare account.
            </p>
            <p className="dw-mono mt-5 text-xs tracking-wide">Open source. Always self-hosted.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {groups.map(({ title, links }) => (
              <div key={title}>
                <h2 className="mb-3 text-sm font-semibold text-fd-foreground">{title}</h2>
                <ul>
                  {links.map(([label, href]) => (
                    <li key={href}>
                      <Link
                        href={href}
                        // min-h-11 gives each link a 44px touch target.
                        className="inline-flex min-h-11 items-center rounded-sm py-2 transition-colors hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fd-primary"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-fd-border pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="leading-relaxed">
            &copy; {year}{" "}
            <a
              href="https://github.com/mrdemonwolf/dirework"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-colors hover:text-fd-foreground"
            >
              DireWork
            </a>{" "}
            by{" "}
            <a
              href="https://www.mrdemonwolf.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-colors hover:text-fd-foreground"
            >
              MrDemonWolf, Inc.
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-6">
            <Link
              href="/docs/privacy-policy"
              className="inline-flex min-h-11 items-center transition-colors hover:text-fd-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="/docs/terms-of-service"
              className="inline-flex min-h-11 items-center transition-colors hover:text-fd-foreground"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
