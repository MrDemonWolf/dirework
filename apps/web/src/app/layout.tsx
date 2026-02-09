import type { Metadata } from "next";

import { Roboto, Montserrat } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dirework",
  description: "Focus timer for your Twitch stream",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} ${montserrat.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
