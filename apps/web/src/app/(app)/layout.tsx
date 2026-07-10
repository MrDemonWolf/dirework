import Header from "@/components/header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Plain worker vars surfaced through process.env by OpenNext — the web
  // worker has no @dirework/env/server (that module is cloudflare:workers +
  // D1 bindings owned by the api worker).
  const privacyPolicyUrl = process.env.PRIVACY_POLICY_URL;
  const termsOfServiceUrl = process.env.TERMS_OF_SERVICE_URL;
  const showLegalLinks = privacyPolicyUrl || termsOfServiceUrl;
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA;

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr_auto]">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground" suppressHydrationWarning>
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
          {commitSha && (
            <>
              <span aria-hidden className="text-muted-foreground/50">
                &middot;
              </span>
              <a
                href={`https://github.com/mrdemonwolf/dirework/commit/${commitSha}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Deployed commit ${commitSha} — view on GitHub`}
                className="font-mono transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {commitSha.slice(0, 7)}
              </a>
            </>
          )}
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
  );
}
