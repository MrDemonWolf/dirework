import { linkVariants } from "@/components/ui/button";

/**
 * "Dashboard → Bot" as a real link. A plain anchor, not next/link: it must never prefetch
 * the dashboard from an OBS dock.
 *
 * It opens a new tab: in a pinned browser tab this page IS the bot, and navigating it away
 * would close the IRC socket, so unmuting from the dashboard would leave the bot offline.
 * `noreferrer` also keeps the token-bearing `/bot/<token>` URL out of the Referer header.
 *
 * It sits in the always-dark notices' muted copy, so it takes the foreground link recipe
 * (`proseOnTint`: foreground text, underlined, the shared `--ring` focus ring), which the
 * `(bot)` layout's `.dark` keeps AAA on the notice background.
 */
export function DashboardBotLink() {
  return (
    <a
      href="/dashboard/bot"
      target="_blank"
      rel="noopener noreferrer"
      className={linkVariants({ variant: "proseOnTint" })}
    >
      Dashboard → Bot
    </a>
  );
}
