/**
 * Standalone chrome-less layout for the bot page — no app header, nav, or footer. Like the
 * (overlay) group, this renders inside the root layout's <html>/<body>, and it paints no
 * background: the default view is a blank widget composited onto a stream (an OBS browser
 * source or a Moblin widget), whose canvas the <head> script (lib/theme-init.ts) marks
 * transparent before the first paint. The dock and the notices paint their own. `dark` pins
 * the dark tokens for those, so they never follow the app theme. It deliberately does not
 * load the heading face: the dock renders in the body face, and only the rare notices use a
 * heading, which falls back to the body face (`--font-heading` in index.css) — so a widget,
 * dock or pinned-tab startup never downloads a font it won't show.
 */
import "./bot-console.css";

export default function BotLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark text-foreground">{children}</div>;
}
