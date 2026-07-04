/**
 * Standalone chrome-less layout for the browser bot console — no app header,
 * nav, or footer. Like the (overlay) group, this renders inside the root
 * layout's <html>/<body>; it only pins the dark instrument-panel background
 * so the page never flashes the app theme.
 */
export default function BotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh bg-zinc-950">{children}</div>;
}
