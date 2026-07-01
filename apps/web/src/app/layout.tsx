import type { Metadata } from "next";

import { IBM_Plex_Mono, IBM_Plex_Sans, Montserrat } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3001"),
  title: {
    default: "DireWork",
    template: "%s | DireWork",
  },
  description:
    "Self-hosted Pomodoro timer and task list with Twitch chat integration for co-working and body-doubling streams.",
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
    description:
      "Self-hosted Pomodoro timer and task list with Twitch chat integration for co-working and body-doubling streams.",
    type: "website",
    siteName: "DireWork",
  },
  twitter: {
    card: "summary_large_image",
    title: "DireWork",
    description:
      "Self-hosted Pomodoro timer and task list with Twitch chat integration for co-working streams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} ${montserrat.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
