import { Inter } from "next/font/google";
import type { Metadata } from "next";

import { Provider } from "@/components/provider";
import { Footer } from "@/components/footer";

import "./global.css";

const inter = Inter({
  subsets: ["latin"],
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
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
        <Footer />
      </body>
    </html>
  );
}
