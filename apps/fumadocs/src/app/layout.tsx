import { IBM_Plex_Sans, IBM_Plex_Mono, Montserrat } from "next/font/google";
import type { Metadata } from "next";

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
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: {
    default: "Dirework - Focus. Together.",
    template: "%s | Dirework",
  },
  description:
    "Self-hosted Pomodoro timer and task list with Twitch chat integration for co-working and body-doubling streams.",
  keywords: [
    "Dirework",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Dirework",
    title: "Dirework - Focus. Together.",
    description:
      "Self-hosted Pomodoro timer and task list with Twitch chat integration for co-working and body-doubling streams.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dirework - Focus. Together.",
    description:
      "Self-hosted Pomodoro timer and task list with Twitch chat integration for co-working and body-doubling streams.",
  },
  metadataBase: new URL("https://mrdemonwolf.github.io/dirework"),
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${montserrat.variable} ${plexSans.className}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen dw-font">
        <a href="#nd-page" className="skip-nav">
          Skip to content
        </a>
        <Provider>{children}</Provider>
        <Footer />
      </body>
    </html>
  );
}
