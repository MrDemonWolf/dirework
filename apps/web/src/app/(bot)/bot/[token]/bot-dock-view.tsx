"use client";

/**
 * Everything the bot page paints for `?view=dock`: the dock panel (`bot-dock.tsx`) on the OBS
 * grey, or the full-screen notice for a phase that needs the owner (an invalid, reset or
 * expired bot page). The blank widget renders none of it, so `bot-console.tsx` loads this
 * module through `next/dynamic` only for the dock: the widget never downloads the dock, its
 * dialogs (Base UI AlertDialog, Button) or StatusChip. SSR stays on, so the dock still paints
 * from the server and its chunk is requested with the page, never later (a chunk fetched
 * after a deploy could 404). The terminal notice lives here too, so a dock that drops into it
 * mid-stream needs no second chunk.
 */

import type { ComponentProps } from "react";

import { StatusChip } from "@/components/status-chip";
import { BOT_TERMINAL_HEADINGS, isTerminalBotPhase } from "@/lib/bot-view";

import { BotDock } from "./bot-dock";
import { DashboardBotLink } from "./dashboard-bot-link";

/** The dock's status LED: `off` is standby (another page has the chat). */
export type BotDockLed = "green" | "amber" | "red" | "off";

/**
 * The LED in OBS's own status colors (`color.obs` green / yellow / red, the dock's text
 * tones), its glow tinted from the same token, so the LED and the dock's status text never
 * show two greens. Shadow geometry is the one arbitrary value (no shadow token scale).
 */
const LED_CLASS: Record<BotDockLed, string> = {
  off: "bg-obs-muted",
  green: "bg-obs-green shadow-[0_0_12px_2px] shadow-obs-green/55",
  amber:
    "bg-obs-yellow shadow-[0_0_12px_2px] shadow-obs-yellow/50 animate-pulse motion-reduce:animate-none",
  red: "bg-obs-red shadow-[0_0_12px_2px] shadow-obs-red/55",
};

export type BotDockViewProps = Omit<ComponentProps<typeof BotDock>, "ledClass"> & {
  led: BotDockLed;
  /** A state that waits on a person (not configured, muted, a chat error): no pulse. */
  steadyLed: boolean;
};

export function BotDockView({ led, steadyLed, ...dock }: BotDockViewProps) {
  const { phase } = dock;
  if (isTerminalBotPhase(phase)) {
    return (
      // role="alert": a live page that drops here unmounts the dock's role="status"
      // header, so without it a screen reader in a pinned tab hears nothing.
      <main role="alert" className="bot-notice">
        <StatusChip tone="danger" label="Action needed" />
        <h1 className="font-mono text-xl font-semibold">{BOT_TERMINAL_HEADINGS[phase]}</h1>
        {phase === "revoked" ? (
          <p>
            This URL was reset. Copy the new one from <DashboardBotLink /> and paste it into your
            OBS dock or tab.
          </p>
        ) : phase === "reauth" ? (
          <p>
            Twitch no longer accepts the bot account&apos;s login. Reconnect it in{" "}
            <DashboardBotLink />, then refresh this page (OBS: right-click the dock → Refresh).
          </p>
        ) : (
          <p>
            This isn&apos;t a valid bot page URL. Copy the current one from <DashboardBotLink />.
          </p>
        )}
      </main>
    );
  }

  // The page is transparent (the widget's layout): the dock's grey fills a wide tab too.
  return (
    <div className="min-h-dvh bg-obs-window">
      <BotDock ledClass={`${LED_CLASS[led]}${steadyLed ? " animate-none" : ""}`} {...dock} />
    </div>
  );
}
