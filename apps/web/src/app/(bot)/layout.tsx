/**
 * Standalone chrome-less layout for the browser bot console — no app header,
 * nav, or footer. Like the (overlay) group, this renders inside the root
 * layout's <html>/<body>; it only pins the dark instrument-panel background
 * so the page never flashes the app theme. It deliberately does not load the
 * heading face: the console renders in the mono face, and only its rare
 * invalid-link/crash screens would use a heading, which fall back to the body
 * face (`--font-heading` in index.css) — so an OBS or pinned-tab startup never
 * downloads a font it won't show.
 */
import "./bot-console.css";

export default function BotLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-dvh bg-background text-foreground">{children}</div>;
}
