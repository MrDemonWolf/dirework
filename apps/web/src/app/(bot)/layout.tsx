import { headingFontBodyCss } from "@/lib/heading-font";

/**
 * Standalone chrome-less layout for the browser bot console — no app header,
 * nav, or footer. Like the (overlay) group, this renders inside the root
 * layout's <html>/<body>; it only pins the dark instrument-panel background
 * so the page never flashes the app theme, and publishes the preloaded heading
 * face for this route (the root layout leaves it out for the overlays' sake;
 * the rule targets <body> so portaled dialogs inherit it too).
 */
export default function BotLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style href="heading-font" precedence="default">
        {headingFontBodyCss}
      </style>
      <div className="min-h-dvh bg-zinc-950">{children}</div>
    </>
  );
}
