"use client";

/**
 * Dirework Bot Console — the browser-held Twitch chat bot.
 *
 * This token-gated page IS the bot:
 * the streamer keeps it open (the blank widget in an OBS browser source or a
 * Moblin widget, or the `?view=dock` panel in an OBS dock or a pinned tab), it
 * holds the IRC WebSocket, and relays command lines to the stateless API which
 * runs the logic against D1 and returns replies to send back to chat.
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
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

import {
  type ChatErrorState,
  noteChatConnected,
  noteChatError,
  noteChatReply,
  noteIngestHealthy,
  noteSessionRefreshed,
  shownChatError,
  watchChatErrorExpiry,
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
import { pageLeaseId, releaseBotLease } from "@/lib/bot-lease-release";
import { deployReloader } from "@/lib/deploy-reload";
import {
  BOT_TERMINAL_HEADINGS,
  botPageTitle,
  isTerminalBotPhase,
  type BotActivityLine,
  type BotView,
} from "@/lib/bot-view";
import { TwitchIrcClient, type IrcStatus } from "@/lib/irc-client";
import { publicTrpc } from "@/utils/public-trpc";

import type { BotDockLed } from "./bot-dock-view";

/**
 * The dock panel and the terminal notice, loaded only when `view === "dock"` renders it: the
 * blank widget never downloads the dock, its dialogs or StatusChip. Server-rendered (SSR on),
 * so the dock paints from the server and its chunk comes with the page, never mid-stream.
 */
const BotDockView = dynamic(() => import("./bot-dock-view").then((m) => m.BotDockView));

/** Lines kept in the activity feed (the dock's recent commands). */
const MAX_ACTIVITY = 20;

type ActivityLine = BotActivityLine;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function timeStamp(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * The bot page. Wires `createBotSession` (state machine in lib/bot-session.ts) to React state;
 * it talks to the api worker directly via `publicTrpc` (token in the POST body, no cookies),
 * never through the web proxy. `view="widget"` (the default) paints nothing: it sits on a
 * stream, so its state goes only to the tab title and a screen-reader live region — even the
 * terminal phases (`invalid`, `revoked`, `reauth`), which the dock and Bot settings show.
 * `view="dock"` is the visible control panel (`bot-dock-view.tsx`), whose terminal phases are a
 * full-screen notice. The session, and so every request, is the same in both.
 */
export function BotConsole({ view = "widget" }: { view?: BotView }) {
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
  // so the status can say "Chat error" (the dock's header, the widget's tab title).
  const [chatErrorState, setChatErrorState] = useState<ChatErrorState | null>(null);
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

  const lineIdRef = useRef(0);
  // The session's events read the view through a ref (the session effect is keyed on the
  // token and Reconnect only): the counters, the activity feed and the last error are dock
  // UI, so the blank widget skips those updates instead of re-rendering for each chat line.
  const dockRef = useRef(view === "dock");
  useEffect(() => {
    dockRef.current = view === "dock";
  }, [view]);

  // A reply-cleared chat error goes away at the end of its window: one timeout per deadline,
  // re-armed whenever the state changes, and nothing armed while no error can expire.
  useEffect(() => watchChatErrorExpiry(chatErrorState, setChatErrorState), [chatErrorState]);

  useEffect(() => {
    if (!token) return;

    const pushActivity = (kind: BotActivityKind, text: string) => {
      if (kind === "error") setChatErrorState((prev) => noteChatError(prev, text, Date.now()));
      if (!dockRef.current) return;
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

    // After a deploy the page reloads once the new build is live (lib/deploy-reload.ts), on
    // an answer it already gets (getSession, the 2-minute heartbeat) and only between
    // commands: nothing relaying, no ban cleanup waiting, no reply queued, no dock click in
    // flight. The reload's pagehide hands the lease straight to the reloaded page.
    const afterCheckIn = <T,>(answer: T): T => {
      void deployReloader()?.check(
        () => sessionRef.current?.idle() === true && !commandBusyRef.current,
      );
      return answer;
    };

    const session = createBotSession({
      token,
      // One id per page load, not per mount: the dock's Reconnect and the (bot) error
      // boundary's restart each start a new session here, renewing the lease the last one held.
      instanceId: pageLeaseId(),
      api: {
        getSession: (input) => publicTrpc.bot.getSession.mutate(input).then(afterCheckIn),
        ingest: (input) => publicTrpc.bot.ingest.mutate(input),
        heartbeat: (input) => publicTrpc.bot.heartbeat.mutate(input).then(afterCheckIn),
        release: (input) => releaseBotLease(input),
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
        onCounter: (counter) => {
          if (!dockRef.current) return;
          setCounters((c) => ({ ...c, [counter]: c[counter] + 1 }));
        },
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
    // Closing (or reloading) the page gives the chat lease up, so the next bot page to open
    // goes live at once instead of standing by until the lease expires.
    const onPageHide = () => session.release();
    window.addEventListener("pagehide", onPageHide);
    // Disposing closes the IRC socket and timers, so a token change or unmount never leaves
    // a second bot relaying the same chat. The lease is kept: the next session (Reconnect, or
    // the error boundary's restart) claims it again under this page load's id.
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      sessionRef.current = null;
      session.dispose();
    };
  }, [token, generation]);

  // One dock click = one bot.ingest request, never retried and never stacked. A promise
  // chain, not try/finally: React Compiler 1.0.0 can't lower a `try` without a `catch` (or
  // with a `finally`), and either one ships the whole component uncompiled
  // (react-compiler.test.ts). runCommand resolves `{ ok: false }` rather than throwing; the
  // finally still frees the busy guard if it ever rejects.
  const runDockCommand = (id: DockCommandId) => {
    const session = sessionRef.current;
    if (!session || commandBusyRef.current) return;
    commandBusyRef.current = true;
    setPendingCommand(id);
    void session
      .runCommand(DOCK_COMMANDS[id].line)
      .then((result) =>
        setCommandResult({ time: timeStamp(), text: dockResultText(result), ok: result.ok }),
      )
      .finally(() => {
        commandBusyRef.current = false;
        setPendingCommand(null);
      });
  };

  // Standby: another bot page holds the chat, so this one is off IRC on purpose.
  const standby = phase === "standby";
  const connected = phase === "live" && ircStatus === "connected";
  // Muted is a deliberate state, not a fault: a steady amber LED, like not-configured.
  const showMuted = connected && muted;
  // Muted posts nothing, so a reply error can only be stale there. The state is pruned at each
  // clear window's end (the expiry effect above), so it is read without a clock.
  const chatError = connected && !showMuted ? shownChatError(chatErrorState) : null;

  const statusText = isTerminalBotPhase(phase)
    ? "Action needed"
    : standby
      ? "Standby"
      : phase === "boot"
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

  // The tab title carries the state in both views: a pinned tab, or the blank widget opened
  // in a browser, still says whether the bot is up.
  useEffect(() => {
    document.title = botPageTitle(statusText);
  }, [statusText]);

  if (view === "widget") {
    // Nothing visible: the widget sits on a stream. Screen readers (and the tab title) get
    // the state; a terminal phase is an alert, so a reader hears the bot stop.
    return (
      <main aria-label="DireWork bot widget" className="sr-only">
        {isTerminalBotPhase(phase) ? (
          <p role="alert">{`DireWork bot: ${BOT_TERMINAL_HEADINGS[phase]}. Open the dock or Dashboard → Bot to fix it.`}</p>
        ) : (
          <p role="status">{`DireWork bot: ${statusText}`}</p>
        )}
      </main>
    );
  }

  // Not-configured, muted and a chat error wait on a person, not on the bot — a steady LED,
  // so none of them reads as "Connecting". Standby is neither a fault nor a wait: a grey LED.
  const led: BotDockLed = standby
    ? "off"
    : phase === "boot" || phase === "not-configured"
      ? "amber"
      : ircStatus === "connected"
        ? showMuted || chatError
          ? "amber"
          : "green"
        : ircStatus === "closed"
          ? "red"
          : "amber";

  return (
    <BotDockView
      led={led}
      steadyLed={phase === "not-configured" || showMuted || chatError !== null}
      statusText={statusText}
      phase={phase}
      muted={muted}
      channelName={channelName}
      botUsername={botUsername}
      // The dock's uptime clock ticks in its own leaf (DockUptime), never here.
      connectedAt={standby ? null : connectedAt}
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
        standby,
      })}
      // One getSession + one forced heartbeat; the dock shows "Starting" until it lands.
      onTakeOver={() => sessionRef.current?.takeOver()}
      onCommand={runDockCommand}
      pending={pendingCommand}
      result={commandResult}
    />
  );
}
