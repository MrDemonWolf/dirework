"use client";

/**
 * The bot page's dock layout (`/bot/<token>?view=dock`): a narrow, tall control panel for an
 * OBS custom browser dock (View → Docks → Custom Browser Docks). It wears OBS Studio's default
 * dark theme (Yami: the `obs-*` color tokens) so it sits in OBS like a native dock, in every
 * app theme. The session, its state and every request live in `bot-console.tsx`; nothing here
 * fetches or polls.
 *
 * Command buttons send ordinary chat command lines (`!timer pause`, `!mute`, `!clear done`)
 * through the session's `runCommand`: the same token-gated `bot.ingest` call chat uses, as the
 * channel broadcaster. One request per click; the reply shows here and is never posted to chat.
 */

import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DOCK_COMMANDS,
  DOCK_TIMER_COMMANDS,
  type DockCommandId,
  type DockControls,
} from "@/lib/bot-dock-commands";
import type { BotActivityKind, BotPhase } from "@/lib/bot-session";
import { recentCommandLines, type BotActivityLine } from "@/lib/bot-view";

/** Command lines (and replies) the dock lists. */
const RECENT_LIMIT = 20;

/** OBS's QPushButton: flat grey, 4px radius, a lighter edge on hover, blue1 focus ring. */
const BUTTON =
  "inline-flex min-h-7 items-center justify-center gap-1.5 rounded-xs border px-2 py-1 text-xs font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-obs-focus disabled:cursor-not-allowed disabled:border-obs-control disabled:bg-obs-base disabled:text-obs-muted";
const BUTTON_TONE = {
  default:
    "border-obs-control-hover bg-obs-control text-obs-text hover:border-obs-edge hover:bg-obs-control-hover active:bg-obs-window",
  // OBS's checked/active control (Start Streaming while live): blue3, blue2 on hover.
  primary:
    "border-obs-primary-hover bg-obs-primary text-obs-text hover:bg-obs-primary-hover active:bg-obs-primary",
} as const;

/** Activity line colors on the dock's grey: every one ≥4.5:1 on `obs-window`. */
const LINE_CLASS: Record<BotActivityKind, string> = {
  info: "text-obs-muted",
  chat: "text-obs-text",
  reply: "text-obs-green",
  error: "text-obs-red",
};

function Section({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={`border-b border-obs-control px-2 py-2 ${className}`}>
      <h2 className="mb-1.5 text-2xs font-semibold text-obs-muted">{label}</h2>
      {children}
    </section>
  );
}

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
  lastError,
  reconnectDisabled,
  onReconnect,
  controls,
  onCommand,
  pending,
  result,
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
  lastError: { time: string; text: string } | null;
  reconnectDisabled: boolean;
  onReconnect: () => void;
  controls: DockControls;
  onCommand: (id: DockCommandId) => void;
  /** The command in flight, if any. */
  pending: DockCommandId | null;
  /** The last click's outcome: the bot's reply, or why it didn't run. */
  result: { time: string; text: string; ok: boolean } | null;
}) {
  const recent = recentCommandLines(activity, RECENT_LIMIT);

  const commandButton = (id: DockCommandId, tone: keyof typeof BUTTON_TONE = "default") => {
    const command = DOCK_COMMANDS[id];
    const disabled = controls.disabled[id];
    const button = (
      <button
        key={id}
        type="button"
        disabled={disabled}
        aria-busy={pending === id}
        // The visible label is the action; the line it sends is the hover hint.
        title={command.line}
        className={`${BUTTON} ${BUTTON_TONE[tone]}`}
        onClick={command.confirm ? undefined : () => onCommand(id)}
      >
        {pending === id ? `${command.label}…` : command.label}
      </button>
    );
    if (!command.confirm || disabled) return button;
    return (
      <ConfirmDialog
        key={id}
        trigger={button}
        title={command.confirm.title}
        description={command.confirm.description}
        confirmLabel={command.confirm.confirmLabel}
        onConfirm={() => onCommand(id)}
      />
    );
  };

  const [start, ...timerRest] = DOCK_TIMER_COMMANDS;

  return (
    <main
      aria-label="DireWork bot dock"
      className="flex h-dvh w-full min-w-0 flex-col overflow-y-auto bg-obs-window font-sans text-xs text-obs-text"
    >
      {/* Title bar, like a QDockWidget title: grey5 with a grey4 rule. */}
      <header className="flex items-center gap-2 border-b border-obs-control bg-obs-title px-2 py-1.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ledClass}`} aria-hidden="true" />
        <span role="status" className="min-w-0 truncate text-sm font-semibold">
          {statusText}
        </span>
        <span className="ml-auto shrink-0 text-2xs font-semibold text-obs-text">DireWork Bot</span>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-b border-obs-control bg-obs-base px-2 py-1.5">
        {(
          [
            ["Channel", channelName ? `#${channelName}` : "—"],
            ["Bot", botUsername || "—"],
            ["Uptime", uptime],
            ["Seen / cmds", `${counters.seen} / ${counters.commands}`],
          ] as const
        ).map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="text-2xs text-obs-muted">{term}</dt>
            <dd className="truncate tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {phase === "not-configured" ? (
        <p className="border-b border-obs-control px-2 py-1.5 text-obs-muted">
          Connect a bot account in Dashboard → Bot. This dock goes live on its own.
        </p>
      ) : muted ? (
        <p className="border-b border-obs-control px-2 py-1.5 text-obs-yellow">
          Muted: the bot ignores chat commands and posts nothing. Unmute to turn it back on.
        </p>
      ) : null}

      <Section label="Timer">
        <div className="grid grid-cols-2 gap-1">
          {start ? <div className="col-span-2 grid">{commandButton(start, "primary")}</div> : null}
          {timerRest.map((id) => commandButton(id))}
        </div>
      </Section>

      <Section label="Bot">
        <div className="grid grid-cols-2 gap-1">
          {commandButton(controls.muteToggle, muted ? "primary" : "default")}
          <button
            type="button"
            onClick={onReconnect}
            disabled={reconnectDisabled}
            title="Restart the bot's Twitch connection"
            className={`${BUTTON} ${BUTTON_TONE.default}`}
          >
            <RotateCw className="size-3" aria-hidden="true" />
            Reconnect
          </button>
        </div>
      </Section>

      <Section label="Tasks">
        <div className="grid grid-cols-2 gap-1">{commandButton("clear-done")}</div>
      </Section>

      <section aria-label="Command result" className="border-b border-obs-control px-2 py-1.5">
        {controls.hint ? <p className="mb-1 text-obs-muted">{controls.hint}</p> : null}
        {/* Live region: a screen reader hears each click's outcome. */}
        <p aria-live="polite" className="break-words">
          {result ? (
            <>
              <span className="text-obs-muted tabular-nums">{result.time}</span>{" "}
              <span className={result.ok ? "text-obs-green" : "text-obs-red"}>{result.text}</span>
            </>
          ) : (
            <span className="text-obs-muted">Button replies show here, not in chat.</span>
          )}
        </p>
      </section>

      <Section label="Last error">
        {lastError ? (
          <p className="break-words text-obs-red">
            <span className="text-obs-muted tabular-nums">{lastError.time}</span> {lastError.text}
          </p>
        ) : (
          <p className="text-obs-muted">None this session</p>
        )}
      </Section>

      <section
        aria-label="Recent commands"
        className="flex min-h-24 flex-1 flex-col border-b border-obs-control px-2 pt-2"
      >
        <h2 className="mb-1.5 text-2xs font-semibold text-obs-muted">Recent commands</h2>
        <div
          // Scrollable region: focusable so keyboard users can scroll it.
          // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll container
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto rounded-xs border border-obs-control bg-obs-base px-1.5 py-1 focus-visible:outline-2 focus-visible:outline-obs-focus"
        >
          {recent.length === 0 ? (
            <p className="text-obs-muted">waiting for chat…</p>
          ) : (
            <ul className="space-y-0.5 leading-4">
              {recent.map((line) => (
                <li key={line.id}>
                  <span className="font-mono text-2xs text-obs-muted tabular-nums">
                    {line.time}
                  </span>{" "}
                  <span className={`break-all ${LINE_CLASS[line.kind]}`}>{line.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-2 shrink-0" />
      </section>

      <p className="px-2 py-1.5 text-2xs text-obs-muted">
        Keep this dock open while you stream: tab it behind another dock if it's in the way. Closing
        it stops the bot.
      </p>
    </main>
  );
}
