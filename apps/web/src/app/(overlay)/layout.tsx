import type { Metadata } from "next";

// Overlay URLs are bearer secrets intended for OBS, never search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  // Overlay fonts are self-hosted by app/globals.css; no runtime Google Fonts
  // request is needed (or permitted by the enforcing CSP).
  // The base layer paints <body> with the theme background; overlays must be
  // transparent on their own, not only when OBS injects its default custom CSS
  // (and in the dashboard's preview iframes, which never get it).
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      {children}
    </>
  );
}
