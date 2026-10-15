import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOT_REAUTH_REQUIRED_MESSAGE } from "@dirework/api/config-shared";

import {
  AUTH_RECOVERY_DELAY_MS,
  MAX_AUTH_RECOVERY,
  NOT_CONFIGURED_POLL_MS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  REVALIDATE_INTERVAL_MS,
  createBotSession,
  retryDelayMs,
  type BotIngestInput,
  type BotIrcClient,
  type BotSessionApi,
} from "../bot-session";
import type { IrcChatMessage, IrcClientCallbacks } from "../irc-client";

function trpcError(code: string, message = code): Error {
  return Object.assign(new Error(message), { data: { code } });
}

const SESSION = { channelName: "streamer", botUsername: "dirework_bot", chatToken: "tok-1" };

function chat(message: string, overrides: Partial<IrcChatMessage> = {}): IrcChatMessage {
  return {
    username: "viewer",
    displayName: "Viewer",
    twitchId: "42",
    message,
    isMod: false,
    isBroadcaster: false,
    ...overrides,
  };
}

function setup(api: Partial<BotSessionApi> = {}) {
  let callbacks: IrcClientCallbacks = {};
  const client = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    say: vi.fn(),
  } satisfies BotIrcClient;
  const getSession = vi.fn(api.getSession ?? (async () => SESSION));
  const ingest = vi.fn(api.ingest ?? (async () => ({ replies: [] as string[] })));
  const events = {
    onPhase: vi.fn(),
    onIrcStatus: vi.fn(),
    onIdentity: vi.fn(),
    onConnected: vi.fn(),
    onCounter: vi.fn(),
    onActivity: vi.fn(),
  };
  const session = createBotSession({
    token: "bot-token",
    api: { getSession, ingest },
    createClient: (cbs) => {
      callbacks = cbs;
      return client;
    },
    events,
    random: () => 0.5,
  });
  return { session, client, getSession, ingest, events, callbacks: () => callbacks };
}

const phases = (events: { onPhase: ReturnType<typeof vi.fn> }) =>
  events.onPhase.mock.calls.map(([p]) => p);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("retryDelayMs", () => {
  it("doubles from the base and caps at the max", () => {
    const mid = () => 0.5;
    expect(retryDelayMs(0, mid)).toBe(RETRY_BASE_MS);
    expect(retryDelayMs(1, mid)).toBe(RETRY_BASE_MS * 2);
    expect(retryDelayMs(20, mid)).toBe(RETRY_MAX_MS);
  });

  it("jitters within ±20%", () => {
    expect(retryDelayMs(0, () => 0)).toBe(RETRY_BASE_MS * 0.8);
    expect(retryDelayMs(0, () => 1)).toBe(RETRY_BASE_MS * 1.2);
  });
});

describe("createBotSession bootstrap", () => {
  it("validates the token against Twitch on startup and connects", async () => {
    const { getSession, client, events } = setup();
    await vi.advanceTimersByTimeAsync(0);

    expect(getSession).toHaveBeenCalledWith({
      token: "bot-token",
      forceRefresh: undefined,
      revalidate: true,
    });
    expect(phases(events)).toEqual(["live"]);
    expect(events.onIdentity).toHaveBeenCalledWith({
      channelName: "streamer",
      botUsername: "dirework_bot",
    });
    expect(client.connect).toHaveBeenCalledWith({
      botUsername: "dirework_bot",
      channelName: "streamer",
      chatToken: "tok-1",
    });
  });

  it("shows an invalid link and stops when the token is wrong from the start", async () => {
    const { getSession, client, events } = setup({
      getSession: async () => {
        throw trpcError("UNAUTHORIZED");
      },
    });
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2);

    expect(phases(events)).toEqual(["invalid"]);
    expect(client.dispose).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("shows an invalid link and stops when getSession rejects the link as malformed", async () => {
    const { getSession, client, events } = setup({
      getSession: async () => {
        throw trpcError("BAD_REQUEST");
      },
    });
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2);

    expect(phases(events)).toEqual(["invalid"]);
    expect(client.dispose).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("drops a BAD_REQUEST ingest without stopping the bot", async () => {
    const { ingest, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);
    ingest.mockRejectedValueOnce(trpcError("BAD_REQUEST"));

    callbacks().onChat?.(chat("!task a"));
    await vi.advanceTimersByTimeAsync(0);

    expect(phases(events)).toEqual(["live"]);
    expect(events.onActivity).toHaveBeenCalledWith(
      "error",
      "could not send that command to Dirework — message dropped",
    );
  });

  it("backs off exponentially on transient errors and keeps the original options", async () => {
    const { getSession, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);
    getSession.mockClear();
    getSession.mockRejectedValue(new Error("fetch failed"));

    callbacks().onAuthFailure?.();
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS);
    expect(getSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS - 1);
    expect(getSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(getSession).toHaveBeenCalledTimes(2);

    // Second gap is doubled.
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 2 - 1);
    expect(getSession).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(getSession).toHaveBeenCalledTimes(3);

    for (const [input] of getSession.mock.calls) {
      expect(input).toEqual({ token: "bot-token", forceRefresh: true, revalidate: false });
    }
    expect(events.onActivity).toHaveBeenCalledWith(
      "error",
      "couldn't reach Dirework (fetch failed) — retrying in 10s",
    );
  });

  it("polls slowly while no bot account is connected, then goes live", async () => {
    const { getSession, client, events } = setup({
      getSession: async () => {
        throw trpcError("NOT_FOUND", "No bot account connected");
      },
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(phases(events)).toEqual(["not-configured"]);
    expect(client.connect).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(NOT_CONFIGURED_POLL_MS * 3);
    expect(getSession).toHaveBeenCalledTimes(4);
    // The "not connected" notice is logged once, not on every poll.
    const notices = events.onActivity.mock.calls.filter(([, text]) =>
      String(text).startsWith("no bot account connected"),
    );
    expect(notices).toHaveLength(1);

    getSession.mockResolvedValue(SESSION);
    await vi.advanceTimersByTimeAsync(NOT_CONFIGURED_POLL_MS);
    expect(phases(events)).toEqual(["not-configured", "live"]);
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it("drops the IRC socket when the bot account disappears while live", async () => {
    const { getSession, client, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);
    getSession.mockRejectedValue(trpcError("NOT_FOUND"));

    callbacks().onAuthFailure?.();
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS);

    expect(phases(events)).toEqual(["live", "not-configured"]);
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("createBotSession auth recovery", () => {
  it("force-refreshes after an auth failure and stops after the recovery budget", async () => {
    const { getSession, client, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);

    for (let i = 0; i < MAX_AUTH_RECOVERY; i++) {
      callbacks().onAuthFailure?.();
      await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS);
    }
    expect(getSession).toHaveBeenCalledTimes(1 + MAX_AUTH_RECOVERY);
    expect(getSession).toHaveBeenLastCalledWith({
      token: "bot-token",
      forceRefresh: true,
      revalidate: false,
    });

    callbacks().onAuthFailure?.();
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS * 10);
    expect(getSession).toHaveBeenCalledTimes(1 + MAX_AUTH_RECOVERY);
    // The link is fine; the bot's Twitch login is what has to be reconnected.
    expect(phases(events).at(-1)).toBe("reauth");
    expect(client.dispose).toHaveBeenCalled();
  });

  it("resets the recovery budget on a clean connect", async () => {
    const { getSession, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);

    for (let i = 0; i < MAX_AUTH_RECOVERY * 2; i++) {
      callbacks().onAuthFailure?.();
      await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS);
      callbacks().onStatus?.("connected");
    }
    expect(getSession).toHaveBeenCalledTimes(1 + MAX_AUTH_RECOVERY * 2);
    expect(phases(events)).not.toContain("revoked");
    expect(events.onConnected).toHaveBeenCalledTimes(MAX_AUTH_RECOVERY * 2);
  });

  it("treats UNAUTHORIZED after going live as a reset link", async () => {
    const { getSession, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);
    getSession.mockRejectedValue(trpcError("UNAUTHORIZED"));

    callbacks().onAuthFailure?.();
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS);
    expect(phases(events)).toEqual(["live", "revoked"]);
  });
});

describe("createBotSession reauth", () => {
  it("stops on the reconnect screen when the bot login can't be refreshed at startup", async () => {
    const { getSession, client, events } = setup({
      getSession: async () => {
        throw trpcError("PRECONDITION_FAILED", BOT_REAUTH_REQUIRED_MESSAGE);
      },
    });
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2);

    expect(phases(events)).toEqual(["reauth"]);
    expect(client.dispose).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("retries other PRECONDITION_FAILED errors as transient", async () => {
    const { getSession, events } = setup({
      getSession: async () => {
        throw trpcError("PRECONDITION_FAILED", "Owner Twitch login unavailable");
      },
    });
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS * 2);

    expect(phases(events)).toEqual([]);
    expect(getSession.mock.calls.length).toBeGreaterThan(1);
  });

  it("keeps a live socket when an hourly revalidation reports reauth", async () => {
    const { getSession, client, events } = setup();
    await vi.advanceTimersByTimeAsync(0);

    getSession.mockRejectedValue(trpcError("PRECONDITION_FAILED", BOT_REAUTH_REQUIRED_MESSAGE));
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);

    expect(phases(events)).toEqual(["live"]);
    expect(client.dispose).not.toHaveBeenCalled();
    expect(events.onActivity).toHaveBeenCalledWith(
      "error",
      "couldn't refresh the bot login — reconnect the bot account in Bot settings",
    );
  });
});

describe("createBotSession revalidation", () => {
  it("reconnects when the streamer renamed their channel", async () => {
    const { getSession, client, events } = setup();
    await vi.advanceTimersByTimeAsync(0);

    getSession.mockResolvedValue({ ...SESSION, channelName: "renamed" });
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);

    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(client.connect).toHaveBeenLastCalledWith({
      botUsername: "dirework_bot",
      channelName: "renamed",
      chatToken: "tok-1",
    });
    expect(events.onActivity).toHaveBeenCalledWith("info", "channel renamed — reconnecting");
  });

  it("reconnects hourly only when the chat token rotated", async () => {
    const { getSession, client, events } = setup();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);
    expect(getSession).toHaveBeenLastCalledWith({ token: "bot-token", revalidate: true });
    expect(client.connect).toHaveBeenCalledTimes(1);

    getSession.mockResolvedValue({ ...SESSION, chatToken: "tok-2" });
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);
    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(client.connect).toHaveBeenLastCalledWith({
      botUsername: "dirework_bot",
      channelName: "streamer",
      chatToken: "tok-2",
    });
    expect(events.onActivity).toHaveBeenCalledWith("info", "chat token refreshed — reconnecting");
  });

  it("ignores transient revalidation errors and revokes on UNAUTHORIZED", async () => {
    const { getSession, events } = setup();
    await vi.advanceTimersByTimeAsync(0);

    getSession.mockRejectedValue(new Error("blip"));
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);
    expect(phases(events)).toEqual(["live"]);

    getSession.mockRejectedValue(trpcError("UNAUTHORIZED"));
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);
    expect(phases(events)).toEqual(["live", "revoked"]);
  });
});

describe("createBotSession ingest", () => {
  it("relays only ! commands, in order, one at a time, and sends replies", async () => {
    const order: string[] = [];
    const gate: { release?: () => void } = {};
    const { ingest, client, events, callbacks } = setup({
      ingest: async (input: BotIngestInput) => {
        const msg = input.kind === "message" ? input.message : "clearchat";
        order.push(`start ${msg}`);
        if (msg === "!task a") await new Promise<void>((r) => (gate.release = r));
        order.push(`end ${msg}`);
        return { replies: [`ok ${msg}`] };
      },
    });
    await vi.advanceTimersByTimeAsync(0);

    callbacks().onChat?.(chat("hello there"));
    callbacks().onChat?.(chat("!task a", { messageId: "msg-1" }));
    callbacks().onChat?.(chat("!done"));
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["start !task a"]);

    gate.release?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(["start !task a", "end !task a", "start !done", "end !done"]);
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(ingest).toHaveBeenNthCalledWith(1, {
      token: "bot-token",
      kind: "message",
      username: "viewer",
      displayName: "Viewer",
      twitchId: "42",
      message: "!task a",
      color: undefined,
      isMod: false,
      messageId: "msg-1",
    });
    expect(client.say.mock.calls).toEqual([["ok !task a"], ["ok !done"]]);
    const counters = events.onCounter.mock.calls.map(([c]) => c);
    expect(counters.filter((c) => c === "seen")).toHaveLength(3);
    expect(counters.filter((c) => c === "commands")).toHaveLength(2);
    expect(counters.filter((c) => c === "replies")).toHaveLength(2);
  });

  it("keeps processing after a failed command", async () => {
    const { ingest, client, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);
    ingest.mockRejectedValueOnce(new Error("boom"));
    ingest.mockResolvedValueOnce({ replies: ["second"] });

    callbacks().onChat?.(chat("!task a"));
    callbacks().onChat?.(chat("!task b"));
    await vi.advanceTimersByTimeAsync(0);

    expect(events.onActivity).toHaveBeenCalledWith(
      "error",
      "could not send that command to Dirework — message dropped",
    );
    expect(client.say.mock.calls).toEqual([["second"]]);
  });

  it("relays clearchat events and revokes on an UNAUTHORIZED ingest", async () => {
    const { ingest, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);
    ingest.mockRejectedValueOnce(trpcError("UNAUTHORIZED"));

    callbacks().onClearChat?.("troll");
    await vi.advanceTimersByTimeAsync(0);

    expect(ingest).toHaveBeenCalledWith({
      token: "bot-token",
      kind: "clearchat",
      targetUsername: "troll",
    });
    expect(phases(events)).toEqual(["live", "revoked"]);

    // Revoked: further callbacks are ignored.
    callbacks().onChat?.(chat("!task c"));
    callbacks().onError?.("late");
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(events.onActivity).not.toHaveBeenCalledWith("error", "late");
  });

  it("forwards IRC status and errors", async () => {
    const { events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);

    callbacks().onStatus?.("reconnecting");
    callbacks().onError?.("socket closed");
    expect(events.onIrcStatus).toHaveBeenCalledWith("reconnecting");
    expect(events.onActivity).toHaveBeenCalledWith("error", "socket closed");
  });
});

describe("createBotSession after revoke", () => {
  it("turns every IRC callback, timer, and in-flight result into a no-op", async () => {
    const pendingIngest: { resolve?: (v: { replies: string[] }) => void } = {};
    const { getSession, ingest, client, events, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);

    // An in-flight command, a queued one, and a scheduled auth recovery are
    // all outstanding when the hourly revalidation finds the link reset.
    ingest.mockImplementationOnce(() => new Promise((r) => (pendingIngest.resolve = r)));
    callbacks().onChat?.(chat("!task a", { displayName: undefined }));
    expect(events.onActivity).toHaveBeenCalledWith("chat", "viewer: !task a");
    ingest.mockRejectedValue(trpcError("UNAUTHORIZED"));
    callbacks().onClearChat?.("troll");
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS - 1000);
    callbacks().onAuthFailure?.();
    getSession.mockRejectedValue(trpcError("UNAUTHORIZED"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(phases(events)).toEqual(["live", "revoked"]);
    await vi.advanceTimersByTimeAsync(AUTH_RECOVERY_DELAY_MS);
    pendingIngest.resolve?.({ replies: ["too late"] });
    await vi.advanceTimersByTimeAsync(0);
    expect(phases(events)).toEqual(["live", "revoked"]);

    events.onActivity.mockClear();
    events.onIrcStatus.mockClear();
    callbacks().onStatus?.("closed");
    callbacks().onAuthFailure?.();
    callbacks().onClearChat?.("someone");
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS + AUTH_RECOVERY_DELAY_MS);

    // Startup + the revalidation; the scheduled recovery never ran.
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(client.say).not.toHaveBeenCalled();
    expect(events.onIrcStatus).not.toHaveBeenCalled();
    expect(events.onActivity).not.toHaveBeenCalled();
    expect(phases(events)).toEqual(["live", "revoked"]);
  });

  it("ignores revalidation results that land after dispose", async () => {
    const { session, getSession, client, events } = setup();
    await vi.advanceTimersByTimeAsync(0);
    const pending: { settle?: () => void } = {};

    getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => (pending.settle = () => resolve({ ...SESSION, chatToken: "x" }))),
    );
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);
    session.dispose();
    pending.settle?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.connect).toHaveBeenCalledTimes(1);

    const second = setup();
    await vi.advanceTimersByTimeAsync(0);
    second.getSession.mockImplementationOnce(
      () => new Promise((_, reject) => (pending.settle = () => reject(trpcError("UNAUTHORIZED")))),
    );
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS);
    second.session.dispose();
    pending.settle?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(phases(second.events)).toEqual(["live"]);
    expect(events.onPhase).toHaveBeenCalledTimes(1);
  });

  it("treats non-Error rejections and non-string codes as transient", async () => {
    const { getSession, events } = setup({
      getSession: () => Promise.reject({ data: { code: 401 } }),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(events.onActivity).toHaveBeenCalledWith(
      "error",
      "couldn't reach Dirework (network error) — retrying in 5s",
    );
    getSession.mockRejectedValue(null);
    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS);
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(phases(events)).toEqual([]);
  });
});

describe("createBotSession dispose", () => {
  it("cancels pending retries and the revalidation loop", async () => {
    const { session, getSession, client, callbacks } = setup();
    await vi.advanceTimersByTimeAsync(0);

    callbacks().onAuthFailure?.();
    session.dispose();
    await vi.advanceTimersByTimeAsync(REVALIDATE_INTERVAL_MS * 2);

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(client.dispose).toHaveBeenCalled();
  });

  it("ignores a getSession result that lands after dispose", async () => {
    const pending: { resolve?: (v: typeof SESSION) => void } = {};
    const { session, client, events } = setup({
      getSession: () => new Promise((r) => (pending.resolve = r)),
    });
    session.dispose();
    pending.resolve?.(SESSION);
    await vi.advanceTimersByTimeAsync(0);

    expect(client.connect).not.toHaveBeenCalled();
    expect(events.onPhase).not.toHaveBeenCalled();
  });
});
