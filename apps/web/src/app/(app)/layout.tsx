// Shell for the signed-in app and public landing pages: skip link, header, and the shared
// footer (AGENTS.md "Footer Convention"). Overlays and the bot console live in other route
// groups and don't get this chrome.

import type { Metadata } from "next";

import Header from "@/components/header";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { VersionBadge } from "@/components/version-badge";
import { headingFontBodyCss } from "@/lib/heading-font";
import { getServerSession } from "@/lib/server-session";

// The install manifest (app/manifest.ts) and the iOS home-screen tags live here, not in the
// root layout, so an OBS overlay or the bot console never fetches the manifest.
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DireWork" },
};

/**
 * Optional legal links render only when their URLs are configured on the web worker.
 * The header gets the server session as a prop, so the nav and account menu are in the
 * first paint; `getServerSession` is `cache()`d, so the page's `requireSession()` reuses
 * this same fetch.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A throw here would bypass (app)/error.tsx (it sits below this layout), so an
  // unreachable api renders a signed-out header; the page's own check still throws into
  // the error boundary with its retry.
  const session = await getServerSession().catch(() => null);
  // Plain worker vars surfaced through process.env by OpenNext — the web
  // worker has no @dirework/env/server (that module is cloudflare:workers +
  // D1 bindings owned by the api worker).
  const privacyPolicyUrl = process.env.PRIVACY_POLICY_URL;
  const termsOfServiceUrl = process.env.TERMS_OF_SERVICE_URL;
  const showLegalLinks = privacyPolicyUrl || termsOfServiceUrl;
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA;

  return (
    <>
      {/* The heading face (preloaded) is published from this layout, not the root, so OBS
          overlays never fetch it; `--font-heading` in index.css falls back to the body face
          wherever the variable is absent. It goes on <body> rather than this wrapper because
          dialogs and menus portal to <body> and would otherwise lose it. */}
      <style href="heading-font" precedence="default">
        {headingFontBodyCss}
      </style>
      <div className="grid min-h-svh grid-rows-[auto_1fr_auto]">
        <a
          href="#main"
          className="sr-only z-(--z-skip-link) rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <ThemeColorSync />
        <Header session={session} />
        {/* Safe-area side insets (landscape phones with viewport-fit=cover) add to each
            page's own gutter; the header, footer and save bar pad themselves the same way.
            min-w-0: a grid item's default min-width is its min-content width, so one wide
            child (the Theme Center preset rail) widened the whole page past a phone. */}
        <main
          id="main"
          className="min-w-0 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
        >
          {children}
        </main>
        {/* suppressHydrationWarning: the copyright year comes from `new Date()`, which can differ
          between the server render and the client around New Year. */}
        <footer
          className="border-t border-border/40 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-center text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3">
            <span>
              &copy; {new Date().getFullYear()}{" "}
              <a
                href="https://github.com/mrdemonwolf/dirework"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                DireWork
              </a>{" "}
              by{" "}
              <a
                href="https://www.mrdemonwolf.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                MrDemonWolf, Inc.
              </a>
            </span>
            {/* Renders its own leading separator, so nothing dangles when there is no SHA. */}
            <VersionBadge sha={commitSha} />
          </div>
          {showLegalLinks && (
            <div className="mt-2 flex items-center justify-center gap-3">
              {privacyPolicyUrl && (
                <a
                  href={privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Privacy Policy
                </a>
              )}
              {privacyPolicyUrl && termsOfServiceUrl && <span>&middot;</span>}
              {termsOfServiceUrl && (
                <a
                  href={termsOfServiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Terms of Service
                </a>
              )}
            </div>
          )}
        </footer>
      </div>
    </>
  );
}
