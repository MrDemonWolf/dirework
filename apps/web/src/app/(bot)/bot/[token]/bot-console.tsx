"use client";

/**
 * Dirework Bot Console — the browser-held Twitch chat bot.
 *
 * Cloudflare Workers can't hold sockets, so this token-gated page IS the bot:
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

import {
  type ChatErrorState,
  currentChatError,
  noteChatConnected,
  noteChatError,
  noteChatReply,
} from "@/lib/bot-chat-error";
import { createBotSession, type BotActivityKind, type BotPhase } from "@/lib/bot-session";
import { TwitchIrcClient, type IrcStatus } from "@/lib/irc-client";
import { publicTrpc } from "@/utils/trpc";

/** Lines kept in the activity feed. */
const MAX_ACTIVITY = 20;

interface ActivityLine {
  id: number;
  time: string;
  kind: BotActivityKind;
  text: string;
}

/** Status LED colours; amber pulses unless the viewer prefers reduced motion. */
const LED_CLASS: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]",
  amber:
    "bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.5)] animate-pulse motion-reduce:animate-none",
  red: "bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.55)]",
};

const LINE_CLASS: Record<BotActivityKind, string> = {
  // console-muted (zinc-400) = 7.76:1 on console-base (zinc-950); zinc-500 was 4.12:1, below AA
  info: "text-console-muted",
  chat: "text-console-soft",
  reply: "text-emerald-300",
  error: "text-red-400",
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

/**
 * "Dashboard → Bot" as a real link. A plain anchor, not next/link: it must never prefetch
 * the dashboard from an OBS source, and OBS ignores clicks anyway.
 */
function DashboardBotLink() {
  return (
    <a
      href="/dashboard/bot"
      className="text-console-fg underline underline-offset-2 hover:text-console-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
    >
      Dashboard → Bot
    </a>
  );
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
    <div className="bg-console-base px-4 py-2">
      <div className="text-2xs tracking-display text-console-muted uppercase">{label}</div>
      <div
        className={`truncate text-sm tabular-nums ${accent ? "text-emerald-300" : "text-console-fg"}`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The bot page. Wires `createBotSession` (state machine in lib/bot-session.ts) to React state;
 * it talks to the api worker directly via `publicTrpc` (token in the POST body, no cookies),
 * never through the web proxy. Terminal phases (`invalid`, `revoked`, `reauth`) replace the
 * console with a full-screen notice.
 */
export function BotConsole() {
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
      if (kind === "error") setChatErrorState(noteChatError(text, Date.now()));
      const line: ActivityLine = {
        id: ++lineIdRef.current,
        time: timeStamp(),
        kind,
        text,
      };
      setActivity((prev) => [...prev.slice(-(MAX_ACTIVITY - 1)), line]);
    };

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
        onIdentity: ({ channelName, botUsername }) => {
          setChannelName(channelName);
          setBotUsername(botUsername);
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
        onReplySent: () => setChatErrorState((prev) => noteChatReply(prev, Date.now())),
        onMuted: setMuted,
      },
    });
    // Disposing closes the IRC socket and timers, so a token change or unmount never leaves
    // a second bot relaying the same chat.
    return session.dispose;
  }, [token]);

  if (phase === "invalid" || phase === "revoked" || phase === "reauth") {
    return (
      // role="alert": a live page that drops here unmounts the role="status"
      // header, so without it a screen reader in a pinned tab hears nothing.
      <main
        role="alert"
        className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-console-base px-6 text-center font-mono"
      >
        <span className={`h-4 w-4 rounded-full ${LED_CLASS.red}`} aria-hidden="true" />
        <h1 className="text-xl font-bold tracking-display text-red-400 uppercase">
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

  const led: "green" | "amber" | "red" =
    phase === "boot" || phase === "not-configured"
      ? "amber"
      : ircStatus === "connected"
        ? showMuted || chatError
          ? "amber"
          : "green"
        : ircStatus === "closed"
          ? "red"
          : "amber"; // connecting / reconnecting / auth-failed / idle

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

  return (
    <main className="flex h-dvh w-full flex-col bg-console-base font-mono text-console-fg">
      {/* Status header — must read as a tiny OBS source (400x200): big LED +
          state text pinned top-left. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-console-line/80 px-4 py-3">
        <span
          // Not-configured, muted and a chat error wait on a person, not on the bot — a
          // steady LED, so none of them reads as "Connecting".
          className={`h-3.5 w-3.5 shrink-0 rounded-full ${LED_CLASS[led]}${phase === "not-configured" || showMuted || chatError ? " animate-none" : ""}`}
          aria-hidden="true"
        />
        <span
          role="status"
          className="truncate text-lg font-bold tracking-display text-console-bright uppercase"
        >
          {statusText}
        </span>
        <span className="ml-auto hidden shrink-0 text-3xs tracking-marquee text-console-muted uppercase sm:block">
          DireWork Bot Console
        </span>
      </header>

      {phase === "not-configured" && (
        <p className="shrink-0 border-b border-console-line/80 px-4 py-2 text-sm text-console-muted">
          Connect a bot account in <DashboardBotLink />. This page goes live on its own.
        </p>
      )}

      {showMuted && (
        <p className="shrink-0 border-b border-console-line/80 px-4 py-2 text-sm text-console-muted">
          Muted — ignoring commands and posting nothing. A mod can send !unmute, or flip the Mute
          bot switch in <DashboardBotLink />.
        </p>
      )}

      {chatError && (
        // Same slot as the muted banner. Clamped to two lines so the counters stay in a
        // 400x200 source; the full text is in the activity log and the title. The header,
        // banners and counters never shrink: the activity log gives up the space instead.
        <p
          title={chatError}
          className="line-clamp-2 shrink-0 border-b border-console-line/80 px-4 py-2 text-xs leading-5 text-amber-300"
        >
          {chatError}
        </p>
      )}

      {/* Identity + uptime */}
      <div className="grid shrink-0 grid-cols-3 gap-px border-b border-console-line/80 bg-console-line/40">
        <StatCell label="Channel" value={channelName ? `#${channelName}` : "—"} />
        <StatCell label="Bot" value={botUsername || "—"} />
        <StatCell
          label="Uptime"
          value={connectedAt && nowTick ? formatUptime(nowTick - connectedAt) : "—"}
        />
      </div>

      {/* Counters */}
      <div className="grid shrink-0 grid-cols-3 gap-px border-b border-console-line/80 bg-console-line/40">
        {/* Every chat line the bot saw; Commands = the ones relayed to DireWork. */}
        <StatCell label="Chat lines" value={String(counters.seen)} />
        <StatCell label="Commands" value={String(counters.commands)} accent />
        <StatCell label="Replies" value={String(counters.replies)} accent />
      </div>

      {/* Activity feed — newest at the bottom, auto-pinned */}
      <div
        ref={logRef}
        role="log"
        aria-label="Activity log"
        // Scrollable region: focusable so keyboard users can scroll it.
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scroll container
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      >
        {activity.length === 0 ? (
          <p className="py-2 text-xs text-console-muted">waiting for chat…</p>
        ) : (
          <ul className="space-y-0.5 text-xs leading-5">
            {activity.map((line) => (
              <li key={line.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-console-muted">{line.time}</span>
                <span className={`break-all ${LINE_CLASS[line.kind]}`}>{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
