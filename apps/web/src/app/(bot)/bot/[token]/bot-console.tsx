"use client";

/**
 * Dirework Bot Console — the browser-held Twitch chat bot.
 *
 * This token-gated page IS the bot:
 * the streamer keeps it open (OBS browser source or pinned tab), it holds the
 * IRC WebSocket, and relays command lines to the stateless API which runs the
 * logic against D1 and returns replies to send back to chat.
 *
 * Keepalive: everything here runs on the WebSocket plus coarse timers
 * (setTimeout / setInterval) — no requestAnimationFrame — so the relay keeps
 * working while the tab is backgrounded (browsers throttle background timers
 * to >= 1s, which is fine for our cadence). OBS browser sources never
 * throttle at all.
 *
 * Secrets: the Twitch chat token stays inside the IRC client instance in
 * memory. It is never rendered, never logged, never put in state.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Activity, Radio } from "lucide-react";

import { StatusChip, type StatusTone } from "@/components/status-chip";
import {
  type ChatErrorState,
  currentChatError,
  noteChatConnected,
  noteChatError,
  noteChatReply,
  noteIngestHealthy,
  noteSessionRefreshed,
} from "@/lib/bot-chat-error";
import {
  DOCK_COMMANDS,
  dockControls,
  dockResultText,
  type DockCommandId,
} from "@/lib/bot-dock-commands";
import {
  createBotSession,
  type BotActivityKind,
  type BotPhase,
  type BotSession,
} from "@/lib/bot-session";
import type { BotActivityLine, BotView } from "@/lib/bot-view";
import { TwitchIrcClient, type IrcStatus } from "@/lib/irc-client";
import { publicTrpc } from "@/utils/trpc";

import { BotDock } from "./bot-dock";
import { DashboardBotLink } from "./dashboard-bot-link";

/** Lines kept in the activity feed. */
const MAX_ACTIVITY = 20;

type ActivityLine = BotActivityLine;

const LED_CLASS: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]",
  amber:
    "bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.5)] animate-pulse motion-reduce:animate-none",
  red: "bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.55)]",
};

const LINE_CLASS: Record<BotActivityKind, string> = {
  info: "text-muted-foreground",
  chat: "text-foreground",
  reply: "text-success",
  error: "text-destructive",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function timeStamp(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** `HH:MM:SS`; hours keep growing past 99 rather than wrapping into days. */
function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function StatCell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bot-stat">
      <dt>{label}</dt>
      <dd className={accent ? "text-link" : undefined} title={value}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The bot page. Wires `createBotSession` (state machine in lib/bot-session.ts) to React state;
 * it talks to the api worker directly via `publicTrpc` (token in the POST body, no cookies),
 * never through the web proxy. Terminal phases (`invalid`, `revoked`, `reauth`) replace the
 * console with a full-screen notice. `view="dock"` swaps the layout for the compact OBS
 * custom-browser-dock panel (`bot-dock.tsx`); the session, and so every request, is the same.
 */
export function BotConsole({ view = "source" }: { view?: BotView }) {
  const { token } = useParams<{ token: string }>();

  const [phase, setPhase] = useState<BotPhase>("boot");
  const [ircStatus, setIrcStatus] = useState<IrcStatus>("idle");
  const [channelName, setChannelName] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [counters, setCounters] = useState({ seen: 0, commands: 0, replies: 0 });
  const [activity, setActivity] = useState<ActivityLine[]>([]);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  // Mod !mute / !unmute (or the dashboard switch), reported by every ingest and getSession.
  const [muted, setMuted] = useState(false);
  // The latest error the session logged (Twitch refusing a reply, a dropped command…), kept
  // so the header can show it: at 400x200 the activity log is below the fold.
  const [chatErrorState, setChatErrorState] = useState<ChatErrorState | null>(null);
  const [nowTick, setNowTick] = useState(0);
  // The newest error line, kept apart from the 20-line feed so the dock can show it after
  // it scrolls out.
  const [lastError, setLastError] = useState<{ time: string; text: string } | null>(null);
  // Bumped by the dock's Reconnect button: the session effect tears down and starts over.
  const [generation, setGeneration] = useState(0);
  // The dock's buttons: whether the session knows the broadcaster, the click in flight, and
  // the last click's outcome.
  const [commandsReady, setCommandsReady] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<DockCommandId | null>(null);
  const [commandResult, setCommandResult] = useState<{
    time: string;
    text: string;
    ok: boolean;
  } | null>(null);
  const sessionRef = useRef<BotSession | null>(null);
  // Synchronous in-flight guard: state lags a double click by a render.
  const commandBusyRef = useRef(false);

  const logRef = useRef<HTMLDivElement | null>(null);
  const lineIdRef = useRef(0);

  // Uptime ticker — coarse 1s interval, safe under background throttling.
  useEffect(() => {
    setNowTick(Date.now());
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pin the activity feed to the newest line (instant jump, reduced-motion safe).
  useEffect(() => {
    if (activity.length === 0) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activity]);

  useEffect(() => {
    if (!token) return;

    const pushActivity = (kind: BotActivityKind, text: string) => {
      if (kind === "error") setChatErrorState((prev) => noteChatError(prev, text, Date.now()));
      const line: ActivityLine = {
        id: ++lineIdRef.current,
        time: timeStamp(),
        kind,
        text,
      };
      setActivity((prev) => [...prev.slice(-(MAX_ACTIVITY - 1)), line]);
      if (kind === "error") setLastError({ time: line.time, text });
    };

    if (generation > 0) pushActivity("info", "reconnecting — requested from the dock");

    const session = createBotSession({
      token,
      api: {
        getSession: (input) => publicTrpc.bot.getSession.mutate(input),
        ingest: (input) => publicTrpc.bot.ingest.mutate(input),
      },
      createClient: (callbacks) => new TwitchIrcClient(callbacks),
      events: {
        onPhase: setPhase,
        onIrcStatus: setIrcStatus,
        onIdentity: ({ channelName, botUsername, commandsReady }) => {
          setChannelName(channelName);
          setBotUsername(botUsername);
          setCommandsReady(commandsReady);
        },
        // Keep the first connect time: uptime spans IRC reconnects within this page load.
        onConnected: () => {
          setConnectedAt((prev) => prev ?? Date.now());
          // A fresh connection supersedes connection errors; a ban, timeout or chat mode
          // survives it, so that banner stays until a later reply goes through.
          setChatErrorState(noteChatConnected);
        },
        onCounter: (counter) => setCounters((c) => ({ ...c, [counter]: c[counter] + 1 })),
        onActivity: pushActivity,
        // Timed from the actual send, not the "reply" activity line: that one fires when the
        // reply is queued, and the rate limiter can hold it past the clear window.
        onIngestHealthy: () => setChatErrorState(noteIngestHealthy),
        onReplySent: () => setChatErrorState((prev) => noteChatReply(prev, Date.now())),
        onSessionRefreshed: () => setChatErrorState(noteSessionRefreshed),
        onMuted: setMuted,
      },
    });
    sessionRef.current = session;
    // Disposing closes the IRC socket and timers, so a token change or unmount never leaves
    // a second bot relaying the same chat.
    return () => {
      sessionRef.current = null;
      session.dispose();
    };
  }, [token, generation]);

  // One dock click = one bot.ingest request, never retried and never stacked.
  const runDockCommand = async (id: DockCommandId) => {
    const session = sessionRef.current;
    if (!session || commandBusyRef.current) return;
    commandBusyRef.current = true;
    setPendingCommand(id);
    try {
      const result = await session.runCommand(DOCK_COMMANDS[id].line);
      setCommandResult({ time: timeStamp(), text: dockResultText(result), ok: result.ok });
    } finally {
      commandBusyRef.current = false;
      setPendingCommand(null);
    }
  };

  if (phase === "invalid" || phase === "revoked" || phase === "reauth") {
    return (
      // role="alert": a live page that drops here unmounts the role="status"
      // header, so without it a screen reader in a pinned tab hears nothing.
      <main role="alert" className="bot-notice">
        <StatusChip tone="danger" label="Action needed" />
        <h1 className="font-mono text-xl font-semibold">
          {phase === "invalid"
            ? "Invalid bot page URL"
            : phase === "revoked"
              ? "Bot page URL reset"
              : "Bot login expired"}
        </h1>
        {phase === "revoked" ? (
          <p className="max-w-sm text-sm text-console-muted">
            This URL was reset. Copy the new one from <DashboardBotLink /> and paste it into your
            OBS browser source or tab.
          </p>
        ) : phase === "reauth" ? (
          <p className="max-w-sm text-sm text-console-muted">
            Twitch no longer accepts the bot account&apos;s login. Reconnect it in{" "}
            <DashboardBotLink />, then refresh this page (OBS: right-click the source → Refresh).
          </p>
        ) : (
          <p className="max-w-sm text-sm text-console-muted">
            This isn&apos;t a valid bot page URL. Copy the current one from <DashboardBotLink />.
          </p>
        )}
      </main>
    );
  }

  const connected = phase !== "boot" && phase !== "not-configured" && ircStatus === "connected";
  // Muted is a deliberate state, not a fault: a steady amber LED, like not-configured.
  const showMuted = connected && muted;
  // Muted posts nothing, so a reply error can only be stale there. `nowTick` (the uptime
  // tick) re-evaluates the clear window every second without a timer of its own.
  const chatError = connected && !showMuted ? currentChatError(chatErrorState, nowTick) : null;

  const tone: StatusTone =
    phase === "boot" || phase === "not-configured"
      ? "warn"
      : ircStatus === "connected"
        ? showMuted || chatError
          ? "warn"
          : "live"
        : ircStatus === "closed"
          ? "danger"
          : "warn";

  const statusText =
    phase === "boot"
      ? "Starting"
      : phase === "not-configured"
        ? "Bot not connected"
        : ircStatus === "connected"
          ? showMuted
            ? "Muted"
            : chatError
              ? "Chat error"
              : "Connected"
          : ircStatus === "connecting"
            ? "Connecting"
            : ircStatus === "reconnecting"
              ? "Reconnecting"
              : ircStatus === "auth-failed"
                ? "Refreshing login"
                : ircStatus === "closed"
                  ? "Offline"
                  : "Starting";

  // Not-configured, muted and a chat error wait on a person, not on the bot — a steady LED,
  // so none of them reads as "Connecting".
  const led = tone === "live" ? "green" : tone === "danger" ? "red" : "amber";
  const ledClass = `${LED_CLASS[led]}${phase === "not-configured" || showMuted || chatError ? " animate-none" : ""}`;

  if (view === "dock") {
    return (
      <BotDock
        ledClass={ledClass}
        statusText={statusText}
        phase={phase}
        muted={muted}
        channelName={channelName}
        botUsername={botUsername}
        uptime={connectedAt && nowTick ? formatUptime(nowTick - connectedAt) : "—"}
        counters={counters}
        activity={activity}
        lastError={lastError}
        // A manual restart costs one getSession, like a page reload; disabled while the bot
        // is already starting or connecting, so repeated clicks can't stack requests.
        reconnectDisabled={
          phase === "boot" || ircStatus === "connecting" || ircStatus === "reconnecting"
        }
        onReconnect={() => {
          setPhase("boot");
          setIrcStatus("idle");
          setCommandsReady(false);
          setGeneration((g) => g + 1);
        }}
        controls={dockControls({
          ready: phase === "live" && commandsReady,
          muted,
          busy: pendingCommand !== null,
        })}
        onCommand={(id) => void runDockCommand(id)}
        pending={pendingCommand}
        result={commandResult}
      />
    );
  }

  return (
    <main className="bot-console font-mono">
      {/* Status header — must read as a tiny OBS source (400x200): big LED +
          state text pinned top-left. */}
      <header className="bot-console-header">
        <span role="status">
          <StatusChip
            tone={tone}
            label={statusText}
            pulse={tone === "warn" && phase !== "not-configured" && !showMuted && !chatError}
            className="bot-connection-status"
          />
        </span>
        <div className="bot-console-brand">
          <Radio size={18} aria-hidden />
          <h1>
            DireWork <span>Bot Console</span>
          </h1>
        </div>
        <span className="bot-header-settings">
          <DashboardBotLink />
        </span>
      </header>

      <div className="bot-console-body">
        <p className="bot-console-instruction font-sans">
          Keep this page open in OBS or a pinned tab. This page runs your Twitch bot.
        </p>

        {phase === "not-configured" && (
          <p className="bot-setup-notice">
            Connect a bot account in <DashboardBotLink />. This page goes live on its own.
          </p>
        )}

        {showMuted && (
          <p className="bot-setup-notice">
            Muted — ignoring commands and posting nothing. A mod can send !unmute, or flip the Mute
            bot switch in <DashboardBotLink />.
          </p>
        )}
        {chatError && (
          <p title={chatError} className="bot-setup-notice line-clamp-2">
            {chatError}
          </p>
        )}

        {/* Identity + uptime */}
        <dl className="bot-stats bot-identity">
          <StatCell label="Channel" value={channelName ? `#${channelName}` : "—"} />
          <StatCell label="Bot" value={botUsername || "—"} />
          <StatCell
            label="Uptime"
            value={connectedAt && nowTick ? formatUptime(nowTick - connectedAt) : "—"}
          />
        </dl>

        {/* Counters */}
        <dl className="bot-stats bot-counters">
          <StatCell label="Chat lines" value={String(counters.seen)} />
          <StatCell label="Commands" value={String(counters.commands)} accent />
          <StatCell label="Replies" value={String(counters.replies)} accent />
        </dl>

        <section className="bot-activity" aria-labelledby="bot-activity-title">
          <div className="bot-activity-heading">
            <h2 id="bot-activity-title">
              <Activity size={15} aria-hidden /> Activity
            </h2>
            <span>Latest {MAX_ACTIVITY} events</span>
          </div>

          {/* Activity feed — newest at the bottom, auto-pinned */}
          <div
            ref={logRef}
            role="log"
            aria-label="Activity log"
            // Scrollable region: focusable so keyboard users can scroll it.
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll container
            tabIndex={0}
            className="bot-activity-log"
          >
            {activity.length === 0 ? (
              <p className="bot-activity-empty">
                Waiting for chat… Commands and bot replies appear here.
              </p>
            ) : (
              <ul className="bot-activity-lines">
                {activity.map((line) => (
                  <li key={line.id}>
                    <span className="bot-activity-time">{line.time}</span>
                    <span className={`bot-activity-kind ${LINE_CLASS[line.kind]}`}>
                      {line.kind}
                    </span>
                    <span className={`break-all ${LINE_CLASS[line.kind]}`}>{line.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
