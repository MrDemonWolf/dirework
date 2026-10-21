// Root layout for the docs + marketing site (apps/fumadocs, static export to GitHub Pages).
// Owns fonts, site-wide metadata, the skip link, the shared footer and JSON-LD; the home and
// docs route groups add their own Fumadocs layouts underneath.

import localFont from "next/font/local";
import Script from "next/script";
import type { Metadata } from "next";
import { BRAND } from "@dirework/overlay-kit";

import { Provider } from "@/components/provider";
import { Footer } from "@/components/footer";

import "./global.css";

// Match the web app's "Focus Console" type system exactly:
// Montserrat display · IBM Plex Sans body · IBM Plex Mono labels & numerals.
// The same self-hosted files as the web app (packages/fonts, downloaded once by
// apps/web/scripts/fetch-fonts.ts and committed), so a build never calls Google Fonts.
// next/font/local needs literal paths, relative to this file.
const plexSans = localFont({
  // Variable font: one file covers weights 400–700.
  src: [
    { path: "../../../../packages/fonts/files/ibm-plex-sans-400_700.woff2", weight: "400 700" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../../../../packages/fonts/files/ibm-plex-mono-400.woff2", weight: "400" },
    { path: "../../../../packages/fonts/files/ibm-plex-mono-500.woff2", weight: "500" },
    { path: "../../../../packages/fonts/files/ibm-plex-mono-600.woff2", weight: "600" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  // Small labels only: not worth a preload on every page.
  preload: false,
});

const montserrat = localFont({
  // Variable font, 400–800, shared with the web app: headings here use 700 and 800
  // (Fumadocs' prose h2/h3 ask for 600 and render at 700).
  src: [{ path: "../../../../packages/fonts/files/montserrat-400_800.woff2", weight: "400 800" }],
  variable: "--font-montserrat",
  display: "swap",
});

/**
 * Site-wide defaults. Pages override title/description (the `%s | DireWork` template applies
 * to theirs); `metadataBase` resolves the relative canonical and OG URLs to the public site.
 */
export const metadata: Metadata = {
  title: {
    default: BRAND.title,
    template: "%s | DireWork",
  },
  description: BRAND.description,
  keywords: [
    "DireWork",
    "Pomodoro",
    "timer",
    "Twitch",
    "task list",
    "co-working",
    "body-doubling",
    "OBS overlay",
    "stream tools",
    "self-hosted",
    "chat bot",
    "streaming",
  ],
  authors: [{ name: "MrDemonWolf, Inc." }],
  creator: "MrDemonWolf, Inc.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    type: "website",
    locale: "en_US",
    siteName: "DireWork",
    title: BRAND.title,
    description: BRAND.description,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.title,
    description: BRAND.description,
  },
  metadataBase: new URL("https://dirework.mrdemonwolf.dev"),
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme provider sets the theme class on <html> before
    // hydration, so the server and client class lists legitimately differ.
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${montserrat.variable} ${plexSans.className}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen dw-font">
        {/* #nd-page is the main-content id Fumadocs' DocsPage renders; the home page sets
            it on its own root so the skip link works there too. */}
        <a href="#nd-page" className="skip-nav">
          Skip to content
        </a>
        <Provider>{children}</Provider>
        <Footer />
        {/* JSON-LD via next/script (id + beforeInteractive) so it lands in the
            static HTML for crawlers without React's in-component <script> warning. */}
        <Script id="dirework-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "DireWork",
            description: BRAND.description,
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web (Cloudflare Workers)",
            url: "https://dirework.mrdemonwolf.dev",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            author: {
              "@type": "Organization",
              name: "MrDemonWolf, Inc.",
              url: "https://www.mrdemonwolf.com",
            },
            codeRepository: "https://github.com/mrdemonwolf/dirework",
          })}
        </Script>
      </body>
    </html>
  );
}
