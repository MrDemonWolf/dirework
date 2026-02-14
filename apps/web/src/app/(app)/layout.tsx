import Header from "@/components/header";
import { env } from "@dirework/env/server";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const privacyPolicyUrl = env.PRIVACY_POLICY_URL;
  const termsOfServiceUrl = env.TERMS_OF_SERVICE_URL;
  const showLegalLinks = privacyPolicyUrl || termsOfServiceUrl;

  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr_auto]">
      <Header />
      {children}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground" suppressHydrationWarning>
        <div>
          &copy; {new Date().getFullYear()}{" "}
          <a
            href="https://github.com/mrdemonwolf/dirework"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium transition-colors hover:text-foreground"
          >
            DireWork
          </a>{" "}
          by{" "}
          <a
            href="https://www.mrdemonwolf.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium transition-colors hover:text-foreground"
          >
            MrDemonWolf, Inc.
          </a>
        </div>
        {showLegalLinks && (
          <div className="mt-2 flex items-center justify-center gap-3">
            {privacyPolicyUrl && (
              <a
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
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
                className="transition-colors hover:text-foreground"
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
