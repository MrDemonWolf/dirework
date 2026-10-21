// Status copy for the bot settings page. Pure, so the "is the bot actually on?" decision is
// unit-tested instead of living in JSX ternaries.

import type { StatusTone } from "@/components/status-chip";

export interface BotMuteStatus {
  tone: StatusTone;
  label: string;
  pulse: boolean;
  description: string;
}

/**
 * The mute bar's chip and sentence. The chip reports the mute switch, never that the bot is
 * running. Only a connected bot account can answer chat, so without one it says Off; the switch still works there, so a streamer can pre-mute
 * before connecting.
 */
export function botMuteStatus({
  muted,
  hasBotAccount,
}: {
  muted: boolean;
  hasBotAccount: boolean;
}): BotMuteStatus {
  if (!hasBotAccount) {
    return muted
      ? {
          tone: "warn",
          label: "Muted",
          pulse: false,
          description:
            "Connect a bot account first. It will start muted: it ignores every command until you unmute it here or a mod sends !unmute.",
        }
      : {
          tone: "idle",
          label: "Off",
          pulse: false,
          description: "Connect a bot account first. Until then nothing answers chat commands.",
        };
  }
  return muted
    ? {
        tone: "warn",
        label: "Muted",
        pulse: true,
        description:
          "The bot ignores every command and posts nothing until it's unmuted here or a mod sends !unmute.",
      }
    : {
        // Unmuted, not "Live": the bot runs only while its bot page is open, which this page
        // can't know without polling.
        tone: "accent",
        label: "Unmuted",
        pulse: false,
        description:
          "The bot answers chat commands while its bot page is open. Mute it to pause everything without closing the page.",
      };
}

/**
 * The Bot console card's chip. A bot token only means the bot page URL exists; whether that
 * page is open in OBS or a tab is unknowable without polling, so the chip never claims the
 * bot is running.
 */
export function botConsoleStatus({
  hasBotAccount,
  hasBotUrl,
}: {
  hasBotAccount: boolean;
  hasBotUrl: boolean;
}): { tone: StatusTone; label: string } {
  return hasBotAccount && hasBotUrl
    ? { tone: "accent", label: "URL ready" }
    : { tone: "idle", label: "Not set up" };
}
