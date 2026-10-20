import { montserrat } from "@/lib/heading-font";

/**
 * Standalone chrome-less layout for the browser bot console — no app header,
 * nav, or footer. Like the (overlay) group, this renders inside the root
 * layout's <html>/<body>; it only pins the dark instrument-panel background
 * so the page never flashes the app theme, and scopes the preloaded heading
 * face to this route (the root layout leaves it out for the overlays' sake).
 */
export default function BotLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${montserrat.variable} min-h-dvh bg-zinc-950`}>{children}</div>;
}
