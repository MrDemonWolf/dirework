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
import { TRPCClientError } from "@trpc/client";

import { TwitchIrcClient, type IrcStatus } from "@/lib/irc-client";
import { publicTrpc } from "@/utils/trpc";

/** Lines kept in the activity feed. */
const MAX_ACTIVITY = 20;

type Phase = "boot" | "live" | "invalid" | "revoked";

type ActivityKind = "info" | "chat" | "reply" | "error";

interface ActivityLine {
  id: number;
  time: string;
  kind: ActivityKind;
  text: string;
}

type IngestInput =
  | {
      token: string;
      kind: "message";
      username: string;
      displayName?: string;
      twitchId: string;
      message: string;
      color?: string;
      isMod: boolean;
    }
  | { token: string; kind: "clearchat"; targetUsername: string };

const LED_CLASS: Record<"green" | "amber" | "red", string> = {
  green: "bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.55)]",
  amber:
    "bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.5)] animate-pulse motion-reduce:animate-none",
  red: "bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.55)]",
};

const LINE_CLASS: Record<ActivityKind, string> = {
  // zinc-400 = 7.76:1 on zinc-950; zinc-500 was 4.12:1, below AA for 12px text
  info: "text-zinc-400",
  chat: "text-zinc-300",
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

function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function isUnauthorized(err: unknown): boolean {
  return (
    err instanceof TRPCClientError &&
    (err.data as { code?: string } | null | undefined)?.code === "UNAUTHORIZED"
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
    <div className="bg-zinc-950 px-4 py-2">
      <div className="text-[10px] tracking-[0.25em] text-zinc-400 uppercase">{label}</div>
      <div
        className={`truncate text-sm tabular-nums ${accent ? "text-emerald-300" : "text-zinc-200"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function BotConsole() {
  const { token } = useParams<{ token: string }>();

  const [phase, setPhase] = useState<Phase>("boot");
  const [ircStatus, setIrcStatus] = useState<IrcStatus>("idle");
  const [channelName, setChannelName] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [counters, setCounters] = useState({ seen: 0, commands: 0, replies: 0 });
  const [activity, setActivity] = useState<ActivityLine[]>([]);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
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

    let disposed = false;
    let revoked = false;
    let wasLive = false;
    let currentChatToken: string | null = null;
    // Bounds the auth-failure recovery loop (P0.5): a refreshable-but-rejected
    // token would otherwise retry every 2s forever. After this many consecutive
    // failed recoveries (no successful connect between them) we stop and require
    // a manual reconnect.
    let authRecoveryAttempts = 0;
    const MAX_AUTH_RECOVERY = 5;
    // Hourly liveness check — validates the token against Twitch and reconnects
    // only if it was rotated. Catches a revoked-but-unexpired token.
    const REVALIDATE_INTERVAL_MS = 60 * 60 * 1000;
    let revalidateTimer: ReturnType<typeof setInterval> | null = null;
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        if (!disposed && !revoked) fn();
      }, ms);
      pendingTimers.add(timer);
    };

    const pushActivity = (kind: ActivityKind, text: string) => {
      const line: ActivityLine = {
        id: ++lineIdRef.current,
        time: timeStamp(),
        kind,
        text,
      };
      setActivity((prev) => [...prev.slice(-(MAX_ACTIVITY - 1)), line]);
    };

    // Token was regenerated on the dashboard — permanent stop for this URL.
    const enterRevoked = () => {
      if (revoked) return;
      revoked = true;
      setPhase("revoked");
      client.dispose();
    };

    /**
     * Relay one chat line to the stateless API. Mutations are deliberately not
     * retried: if D1 commits but the response is lost, an automatic retry would
     * apply commands such as !done, !next, or !timer skip twice.
     */
    const ingestOnce = async (input: IngestInput): Promise<string[]> => {
      try {
        const result = await publicTrpc.bot.ingest.mutate(input);
        return result.replies;
      } catch (err) {
        if (isUnauthorized(err)) enterRevoked();
        else pushActivity("error", "could not send that command to Dirework — message dropped");
        return [];
      }
    };

    /**
     * Chat commands are relayed ONE AT A TIME (P1.7). Ingest used to be fired
     * as a detached async call per PRIVMSG, so two commands from the same
     * viewer could execute against the same DB snapshot and interleave — e.g.
     * "!done" and "!task" racing over which task ends up active. Chaining on a
     * promise preserves chat order and keeps the bot to one in-flight mutation.
     */
    let ingestChain: Promise<unknown> = Promise.resolve();
    const ingest = (input: IngestInput): Promise<string[]> => {
      const next = ingestChain.then(() => ingestOnce(input));
      // Keep the chain alive even if a link rejects, or every later command
      // would inherit the rejection and silently stop being processed.
      ingestChain = next.catch(() => undefined);
      return next;
    };

    const client = new TwitchIrcClient({
      onStatus: (status) => {
        if (disposed || revoked) return;
        setIrcStatus(status);
        if (status === "connected") {
          authRecoveryAttempts = 0; // a clean connect clears the recovery budget
          setConnectedAt((prev) => prev ?? Date.now());
          pushActivity("info", "connected to Twitch IRC");
        }
      },
      onChat: (chat) => {
        if (disposed || revoked) return;
        setCounters((c) => ({ ...c, seen: c.seen + 1 }));
        const text = chat.message.trim();
        // Every Dirework command starts with "!" — skipping plain chatter
        // saves free-tier Worker requests.
        if (!text.startsWith("!")) return;
        setCounters((c) => ({ ...c, commands: c.commands + 1 }));
        pushActivity("chat", `${chat.displayName ?? chat.username}: ${text}`);
        void (async () => {
          const replies = await ingest({
            token,
            kind: "message",
            username: chat.username,
            displayName: chat.displayName,
            twitchId: chat.twitchId,
            message: text,
            color: chat.color,
            isMod: chat.isMod,
          });
          if (disposed || revoked) return;
          for (const reply of replies) {
            client.say(reply);
            setCounters((c) => ({ ...c, replies: c.replies + 1 }));
            pushActivity("reply", `→ ${reply}`);
          }
        })();
      },
      onClearChat: (targetUsername) => {
        if (disposed || revoked) return;
        pushActivity("info", `clearchat: ${targetUsername} — removing their tasks`);
        // No replies expected for moderation events.
        void ingest({ token, kind: "clearchat", targetUsername });
      },
      onError: (message) => {
        if (disposed || revoked) return;
        pushActivity("error", message);
      },
      onAuthFailure: () => {
        if (disposed || revoked) return;
        // Twitch rejected the stored token, so its DB expiry can't be trusted
        // — force the server through the refresh flow instead of letting it
        // hand back the same dead token. Small delay avoids a tight loop.
        authRecoveryAttempts += 1;
        if (authRecoveryAttempts > MAX_AUTH_RECOVERY) {
          pushActivity(
            "error",
            "Twitch keeps rejecting the bot login — reconnect the bot account from the dashboard",
          );
          enterRevoked();
          return;
        }
        pushActivity("error", "Twitch rejected the bot's login — refreshing it");
        later(() => bootstrap({ forceRefresh: true }), 2000);
      },
    });

    async function bootstrap(opts: { forceRefresh?: boolean } = {}): Promise<void> {
      try {
        const session = await publicTrpc.bot.getSession.mutate({
          token,
          forceRefresh: opts.forceRefresh,
        });
        if (disposed || revoked) return;
        setChannelName(session.channelName);
        setBotUsername(session.botUsername);
        setPhase("live");
        wasLive = true;
        currentChatToken = session.chatToken;
        client.connect({
          botUsername: session.botUsername,
          channelName: session.channelName,
          // Memory only — handed straight to the IRC client, never rendered.
          chatToken: session.chatToken,
        });
        startRevalidateLoop();
      } catch (err) {
        if (disposed || revoked) return;
        if (isUnauthorized(err)) {
          if (wasLive) {
            // Token rotated while we were running.
            enterRevoked();
          } else {
            // Bad link from the start — show nothing else (no details).
            setPhase("invalid");
            client.dispose();
          }
          return;
        }
        const reason = err instanceof TRPCClientError ? err.message : "network error";
        pushActivity("error", `couldn't reach Dirework (${reason}) — retrying in 5s`);
        later(bootstrap, 5000);
      }
    }

    function startRevalidateLoop(): void {
      if (revalidateTimer) return;
      revalidateTimer = setInterval(() => {
        if (disposed || revoked) return;
        void revalidate();
      }, REVALIDATE_INTERVAL_MS);
    }

    async function revalidate(): Promise<void> {
      try {
        const session = await publicTrpc.bot.getSession.mutate({ token, revalidate: true });
        if (disposed || revoked) return;
        // Only reconnect when the token actually rotated — an unchanged token
        // means the socket is still valid and must not be churned hourly.
        if (session.chatToken !== currentChatToken) {
          currentChatToken = session.chatToken;
          setChannelName(session.channelName);
          setBotUsername(session.botUsername);
          pushActivity("info", "chat token refreshed — reconnecting");
          client.connect({
            botUsername: session.botUsername,
            channelName: session.channelName,
            chatToken: session.chatToken,
          });
        }
      } catch (err) {
        if (disposed || revoked) return;
        if (isUnauthorized(err)) {
          enterRevoked();
          return;
        }
        // Transient — the next hourly tick retries.
      }
    }

    pushActivity("info", "bot console starting");
    void bootstrap();

    return () => {
      disposed = true;
      for (const timer of pendingTimers) clearTimeout(timer);
      if (revalidateTimer) clearInterval(revalidateTimer);
      client.dispose();
    };
  }, [token]);

  if (phase === "invalid" || phase === "revoked") {
    return (
      <main className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center font-mono">
        <span className={`h-4 w-4 rounded-full ${LED_CLASS.red}`} aria-hidden="true" />
        <h1 className="text-xl font-bold tracking-[0.2em] text-red-400 uppercase">
          {phase === "invalid" ? "Invalid bot link" : "Link reset"}
        </h1>
        {phase === "revoked" ? (
          <p className="max-w-sm text-sm text-zinc-400">
            This URL was reset. Copy the new one from Bot settings.
          </p>
        ) : null}
      </main>
    );
  }

  const led: "green" | "amber" | "red" =
    phase === "boot"
      ? "amber"
      : ircStatus === "connected"
        ? "green"
        : ircStatus === "closed"
          ? "red"
          : "amber"; // connecting / reconnecting / auth-failed / idle

  const statusText =
    phase === "boot"
      ? "Starting"
      : ircStatus === "connected"
        ? "Connected"
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
    <main className="flex h-dvh w-full flex-col bg-zinc-950 font-mono text-zinc-200">
      {/* Status header — must read as a tiny OBS source (400x200): big LED +
          state text pinned top-left. */}
      <header className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
        <span
          className={`h-3.5 w-3.5 shrink-0 rounded-full ${LED_CLASS[led]}`}
          aria-hidden="true"
        />
        <span
          role="status"
          className="truncate text-lg font-bold tracking-[0.2em] text-zinc-100 uppercase"
        >
          {statusText}
        </span>
        <span className="ml-auto hidden shrink-0 text-[10px] tracking-[0.3em] text-zinc-400 uppercase sm:block">
          Dirework Bot Console
        </span>
      </header>

      {/* Identity + uptime */}
      <div className="grid grid-cols-3 gap-px border-b border-zinc-800/80 bg-zinc-800/40">
        <StatCell label="Channel" value={channelName ? `#${channelName}` : "—"} />
        <StatCell label="Bot" value={botUsername || "—"} />
        <StatCell
          label="Uptime"
          value={connectedAt && nowTick ? formatUptime(nowTick - connectedAt) : "—"}
        />
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-px border-b border-zinc-800/80 bg-zinc-800/40">
        <StatCell label="Seen" value={String(counters.seen)} />
        <StatCell label="Commands" value={String(counters.commands)} accent />
        <StatCell label="Replies" value={String(counters.replies)} accent />
      </div>

      {/* Activity feed — newest at the bottom, auto-pinned */}
      <div
        ref={logRef}
        role="log"
        aria-label="Activity log"
        className="flex-1 overflow-y-auto px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      >
        {activity.length === 0 ? (
          <p className="py-2 text-xs text-zinc-400">waiting for chat…</p>
        ) : (
          <ul className="space-y-0.5 text-xs leading-5">
            {activity.map((line) => (
              <li key={line.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-zinc-400">{line.time}</span>
                <span className={`break-all ${LINE_CLASS[line.kind]}`}>{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
