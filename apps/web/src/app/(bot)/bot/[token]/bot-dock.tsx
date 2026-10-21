"use client";

/**
 * The bot page's dock layout (`/bot/<token>?view=dock`): a narrow, tall control panel for an
 * OBS custom browser dock (View → Docks → Custom Browser Docks). Presentation only — the
 * session, its state and every request live in `bot-console.tsx`, which renders this in
 * place of the ~400×200 browser-source layout. Nothing here fetches or polls.
 *
 * Mute is shown, not toggled: the only mute writes are the owner's `config.setBotMuted`
 * (session cookie) and a mod's `!mute` / `!unmute` in chat. This page holds only the bot
 * token, and a token-gated mute procedure would be new server surface.
 */

import { RotateCw } from "lucide-react";

import type { BotActivityKind, BotPhase } from "@/lib/bot-session";
import { recentCommandLines, type BotActivityLine } from "@/lib/bot-view";

/** Command lines (and replies) the dock lists. */
const RECENT_LIMIT = 12;

export function BotDock({
  ledClass,
  statusText,
  phase,
  muted,
  channelName,
  botUsername,
  uptime,
  counters,
  activity,
  lineClass,
  lastError,
  reconnectDisabled,
  onReconnect,
}: {
  ledClass: string;
  statusText: string;
  phase: BotPhase;
  muted: boolean;
  channelName: string;
  botUsername: string;
  uptime: string;
  counters: { seen: number; commands: number; replies: number };
  activity: readonly BotActivityLine[];
  lineClass: Record<BotActivityKind, string>;
  lastError: { time: string; text: string } | null;
  reconnectDisabled: boolean;
  onReconnect: () => void;
}) {
  const recent = recentCommandLines(activity, RECENT_LIMIT);

  return (
    <main
      aria-label="DireWork bot dock"
      className="flex h-dvh w-full flex-col overflow-y-auto bg-console-base font-mono text-console-fg"
    >
      <header className="flex items-center gap-2.5 border-b border-console-line/80 px-3 py-2.5">
        <span className={`h-3 w-3 shrink-0 rounded-full ${ledClass}`} aria-hidden="true" />
        <span
          role="status"
          className="truncate text-base font-bold tracking-display text-console-bright uppercase"
        >
          {statusText}
        </span>
      </header>

      <dl className="space-y-1 border-b border-console-line/80 px-3 py-2 text-xs">
        {(
          [
            ["Channel", channelName ? `#${channelName}` : "—", ""],
            ["Bot", botUsername || "—", ""],
            ["Uptime", uptime, "tabular-nums"],
            // Muted is a deliberate state, not a fault: amber, like the LED.
            ["Muted", muted ? "Yes" : "No", muted ? "text-amber-300" : ""],
          ] as const
        ).map(([term, value, tone]) => (
          <div key={term} className="flex items-baseline gap-3">
            <dt className="w-14 shrink-0 text-console-muted">{term}</dt>
            <dd className={`min-w-0 truncate ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {phase === "not-configured" ? (
        <p className="border-b border-console-line/80 px-3 py-2 text-xs text-console-muted">
          Connect a bot account in Dashboard → Bot. This dock goes live on its own.
        </p>
      ) : muted ? (
        <p className="border-b border-console-line/80 px-3 py-2 text-xs text-console-muted">
          Ignoring commands and posting nothing. A mod can send !unmute, or flip the Muted switch in
          Dashboard → Bot.
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-px border-b border-console-line/80 bg-console-line/40 text-center">
        {(
          [
            ["Seen", counters.seen],
            ["Cmds", counters.commands],
            ["Replies", counters.replies],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-console-base px-1 py-1.5">
            <div className="text-3xs tracking-display text-console-muted uppercase">{label}</div>
            <div className="text-sm tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="border-b border-console-line/80 px-3 py-2">
        <button
          type="button"
          onClick={onReconnect}
          disabled={reconnectDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-console-line px-3 py-1.5 text-xs font-medium tracking-display text-console-bright uppercase transition-colors hover:bg-console-line/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          Reconnect
        </button>
      </div>

      <section aria-label="Last error" className="border-b border-console-line/80 px-3 py-2">
        <h2 className="text-3xs tracking-display text-console-muted uppercase">Last error</h2>
        {lastError ? (
          <p className="mt-0.5 text-xs break-words text-red-400">
            <span className="text-console-muted tabular-nums">{lastError.time}</span>{" "}
            {lastError.text}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-console-muted">None this session</p>
        )}
      </section>

      <section aria-label="Recent commands" className="flex-1 px-3 py-2">
        <h2 className="text-3xs tracking-display text-console-muted uppercase">Recent commands</h2>
        {recent.length === 0 ? (
          <p className="mt-0.5 text-xs text-console-muted">waiting for chat…</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs leading-4">
            {recent.map((line) => (
              <li key={line.id}>
                <span className="text-console-muted tabular-nums">{line.time}</span>{" "}
                <span className={`break-all ${lineClass[line.kind]}`}>{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="border-t border-console-line/80 px-3 py-2 text-3xs text-console-muted">
        Keep this dock open while you stream: tab it behind another dock if it's in the way. Closing
        it stops the bot.
      </p>
    </main>
  );
}
