// Root layout for every route (dashboard, overlays, bot console): fonts, global CSS, and
// site-wide metadata. Keep it lean, since OBS overlays load it too.

import type { Metadata, Viewport } from "next";

import { BRAND } from "@dirework/overlay-kit";

import "../index.css";
import { webOrigin } from "@/lib/api-origin";
import { plexMono, plexSans } from "@/lib/fonts";
import { OG_IMAGE } from "@/lib/og-image";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import { SCHEME_HEX } from "@/tokens.generated";

// viewportFit "cover" lets an installed app draw under the notch and home indicator; the
// header, footer, save bar and toasts pad themselves with env(safe-area-inset-*). The theme
// colours tint the browser/status bar to match the page background (`--background`, as the
// generated hex in tokens.generated.ts).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: SCHEME_HEX.dark.background },
    { media: "(prefers-color-scheme: light)", color: SCHEME_HEX.light.background },
  ],
};

// Only the body and mono faces live here (not preloaded: this layout also wraps the OBS
// overlays, which render their own configured fonts). The heading face is applied by the
// (app) layout only, so its preload never reaches an overlay or the bot console — see
// lib/heading-font.ts.
// The overlay font stylesheet (public/fonts/fonts.css) is loaded by the (overlay) layout and
// the Theme Center page, the two surfaces that render overlay content.

export function generateMetadata(): Metadata {
  // The web origin (BETTER_AUTH_URL, via webOrigin) is the canonical base — deterministic
  // and request-independent so pages can render statically.
  return {
    metadataBase: new URL(webOrigin()),
    icons: {
      icon: { url: "/icons/icon.svg", type: "image/svg+xml", sizes: "any" },
      apple: { url: "/icons/apple-icon.png", sizes: "180x180" },
    },
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
    authors: [{ name: BRAND.owner.name, url: BRAND.owner.url }],
    creator: BRAND.owner.name,
    openGraph: {
      title: "DireWork",
      description: BRAND.description,
      type: "website",
      siteName: "DireWork",
      // A static file rendered at build (scripts/render-og.ts), not an opengraph-image route.
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: "DireWork",
      description: BRAND.description,
      images: [OG_IMAGE],
    },
  };
}

/**
 * suppressHydrationWarning on <html>: the inline <head> script (lib/theme-init.ts) sets the
 * theme class and color-scheme before first paint on every route, and next-themes (mounted by
 * the (app) layout only) keeps them in sync after, so <html> never matches the server markup (see AGENTS.md "Hydration Safety"). The script
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
      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
