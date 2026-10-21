// Root layout for the docs + marketing site (apps/fumadocs, static export to GitHub Pages).
// Owns fonts, site-wide metadata, the skip link, the shared footer and JSON-LD; the home and
// docs route groups add their own Fumadocs layouts underneath.

import { IBM_Plex_Sans, IBM_Plex_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import type { Metadata } from "next";
import { BRAND } from "@dirework/overlay-kit";

import { Provider } from "@/components/provider";
import { Footer } from "@/components/footer";

import "./global.css";

// Match the web app's "Focus Console" type system exactly:
// Montserrat display · IBM Plex Sans body · IBM Plex Mono labels & numerals.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  // Small labels only: not worth a preload on every page.
  preload: false,
});

const montserrat = Montserrat({
  subsets: ["latin"],
  // The two weights headings use. Fumadocs' prose h2/h3 ask for 600 and render at 700.
  weight: ["700", "800"],
  variable: "--font-montserrat",
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
