/**
 * "Dashboard → Bot" as a real link. A plain anchor, not next/link: it must never prefetch
 * the dashboard from an OBS source, and OBS ignores clicks anyway.
 *
 * It opens a new tab: in a pinned browser tab this page IS the bot, and navigating it away
 * would close the IRC socket, so unmuting from the dashboard would leave the bot offline.
 * `noreferrer` also keeps the token-bearing `/bot/<token>` URL out of the Referer header.
 */
export function DashboardBotLink() {
  return (
    <a
      href="/dashboard/bot"
      target="_blank"
      rel="noopener noreferrer"
      className="text-console-fg underline underline-offset-2 hover:text-console-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
    >
      Dashboard → Bot
    </a>
  );
}
