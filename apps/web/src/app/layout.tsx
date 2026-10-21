// Root layout for every route (dashboard, overlays, bot console): fonts, global CSS, and
// site-wide metadata. Keep it lean, since OBS overlays load it too.

import type { Metadata } from "next";

import { BRAND } from "@dirework/overlay-kit";

import "../index.css";
import Providers from "@/components/providers";
import { plexMono, plexSans } from "@/lib/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";

// Only the body and mono faces live here (not preloaded: this layout also wraps the OBS
// overlays, which render their own configured fonts). The heading face is applied by the
// (app) layout only, so its preload never reaches an overlay or the bot console — see
// lib/heading-font.ts.
// The overlay font stylesheet (public/fonts/fonts.css) is loaded by the (overlay) layout and
// the Theme Center page, the two surfaces that render overlay content.

export function generateMetadata(): Metadata {
  // BETTER_AUTH_URL (the web origin, bound on the worker in prod and dev) is
  // the canonical base — deterministic and request-independent so pages can
  // render statically. Localhost fallback only covers bare local tooling.
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3001";

  return {
    metadataBase: new URL(base),
    title: {
      default: "DireWork",
      template: "%s | DireWork",
    },
    description: BRAND.description,
    keywords: [
      "pomodoro",
      "twitch",
      "timer",
      "task list",
      "co-working",
      "body doubling",
      "stream overlay",
      "OBS",
      "focus timer",
    ],
    authors: [{ name: "MrDemonWolf, Inc.", url: "https://www.mrdemonwolf.com" }],
    creator: "MrDemonWolf, Inc.",
    openGraph: {
      title: "DireWork",
      description: BRAND.description,
      type: "website",
      siteName: "DireWork",
    },
    twitter: {
      card: "summary_large_image",
      title: "DireWork",
      description: BRAND.description,
    },
  };
}

/**
 * suppressHydrationWarning on <html>: the inline <head> script (lib/theme-init.ts) sets the
 * theme class and color-scheme before first paint, and next-themes keeps them in sync after,
 * so <html> never matches the server markup (see AGENTS.md "Hydration Safety"). The script
 * sits in <head>, not <body>, so a streamed dark page never paints white first. Next merges
 * the metadata tags into this <head>.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* A static constant, never user input: see lib/theme-init.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
