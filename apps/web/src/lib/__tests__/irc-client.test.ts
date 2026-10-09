import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseIrcLine, TwitchIrcClient, type IrcClientCallbacks } from "../irc-client";

/** Minimal stand-in for the browser WebSocket, driven by the test. */
class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(line: string) {
    this.sent.push(line);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }

  // ── test drivers ──
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(...lines: string[]) {
    this.onmessage?.({ data: lines.map((line) => `${line}\r\n`).join("") });
  }

  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const CREDS = { botUsername: "DireBot", channelName: "Streamer", chatToken: "tok123" };

function latestSocket(): FakeWebSocket {
  const ws = FakeWebSocket.instances.at(-1);
  if (!ws) throw new Error("no socket opened");
  return ws;
}

function setup(callbacks: IrcClientCallbacks = {}) {
  const client = new TwitchIrcClient(callbacks);
  client.connect(CREDS);
  return { client, ws: latestSocket() };
}

/** Connect, open, and complete the 001 welcome. */
function connected(callbacks: IrcClientCallbacks = {}) {
  const { client, ws } = setup(callbacks);
  ws.open();
  ws.receive(":tmi.twitch.tv 001 direbot :Welcome, GLHF!");
  return { client, ws };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseIrcLine", () => {
  it("parses a real Twitch PRIVMSG with escaped tags and a trailing containing ' :'", () => {
    const msg = parseIrcLine(
      "@badges=moderator/1;color=#FF0000;display-name=Cool\\sGuy;mod=1;note=a\\:b\\\\c;user-id=123 " +
        ":coolguy!coolguy@coolguy.tmi.twitch.tv PRIVMSG #streamer :hello :) world",
    );

    expect(msg.command).toBe("PRIVMSG");
    expect(msg.prefix).toBe("coolguy!coolguy@coolguy.tmi.twitch.tv");
    expect(msg.params).toEqual(["#streamer"]);
    expect(msg.trailing).toBe("hello :) world");
    expect(msg.tags.get("display-name")).toBe("Cool Guy");
    expect(msg.tags.get("note")).toBe("a;b\\c");
    expect(msg.tags.get("user-id")).toBe("123");
  });

  it("keeps valueless tags and lines without tags, prefix, or trailing", () => {
    expect(parseIrcLine("@flag;x=1 PING").tags.get("flag")).toBe("");
    expect(parseIrcLine("PING :tmi.twitch.tv")).toMatchObject({
      command: "PING",
      prefix: "",
      trailing: "tmi.twitch.tv",
    });
    expect(parseIrcLine(":tmi.twitch.tv CAP * ACK")).toMatchObject({
      command: "CAP",
      params: ["*", "ACK"],
      trailing: null,
    });
  });

  it("stores prototype-named tags as plain data without touching any prototype", () => {
    const msg = parseIrcLine("@__proto__=x;constructor=y;user-id=1 :a!a@a PRIVMSG #c :hi");

    expect(msg.tags.get("__proto__")).toBe("x");
    expect(msg.tags.get("constructor")).toBe("y");
    expect(msg.tags.get("user-id")).toBe("1");
    expect(Object.getPrototypeOf(msg.tags)).toBe(Map.prototype);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("unescapes CR, LF, unknown escapes, and drops a trailing lone backslash", () => {
    const msg = parseIrcLine("@a=1\\r\\n2;b=x\\qy;c=end\\;;d PING");
    expect(msg.tags.get("a")).toBe("1\r\n2");
    expect(msg.tags.get("b")).toBe("xqy");
    expect(msg.tags.get("c")).toBe("end");
    expect(msg.tags.get("d")).toBe("");
  });

  it("handles a tags-only, a prefix-only, and an empty line", () => {
    expect(parseIrcLine("@a=b")).toMatchObject({ command: "", params: [] });
    expect(parseIrcLine("@a=b").tags.get("a")).toBe("b");
    expect(parseIrcLine(":tmi.twitch.tv")).toMatchObject({ prefix: "tmi.twitch.tv", command: "" });
    expect(parseIrcLine("")).toMatchObject({ command: "", trailing: null });
  });
});

describe("TwitchIrcClient connection", () => {
  it("authenticates on open, joins on 001, and reports connected", () => {
    const onStatus = vi.fn();
    const { client, ws } = setup({ onStatus });

    ws.open();
    expect(ws.sent).toEqual([
      "CAP REQ :twitch.tv/tags twitch.tv/commands",
      "PASS oauth:tok123",
      "NICK direbot",
    ]);

    ws.receive(":tmi.twitch.tv 001 direbot :Welcome, GLHF!");
    expect(ws.sent.at(-1)).toBe("JOIN #streamer");
    expect(client.getStatus()).toBe("connected");
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(["connecting", "connected"]);
  });

  it("answers a server PING with PONG", () => {
    const { ws } = connected();
    ws.receive("PING :tmi.twitch.tv");
    expect(ws.sent.at(-1)).toBe("PONG :tmi.twitch.tv");
  });

  it("refuses credentials that could break out of an IRC frame", () => {
    const onError = vi.fn();
    const onAuthFailure = vi.fn();
    const client = new TwitchIrcClient({ onError, onAuthFailure });
    client.connect({ ...CREDS, channelName: "streamer\r\nJOIN #evil" });

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(client.getStatus()).toBe("auth-failed");
    expect(onError).toHaveBeenCalledWith("Invalid Twitch IRC credentials");
    // The owner must recover (bounded), not wait on a socket that never opens.
    expect(onAuthFailure).toHaveBeenCalledOnce();
  });

  it("backs off 1s, 2s, 4s … capped at 30s, and a 001 resets the backoff", () => {
    setup();
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = FakeWebSocket.instances.length;
      latestSocket().drop();
      let waited = 0;
      while (FakeWebSocket.instances.length === before) {
        vi.advanceTimersByTime(250);
        waited += 250;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);

    const ws = latestSocket();
    ws.open();
    ws.receive(":tmi.twitch.tv 001 direbot :Welcome");
    ws.drop();
    vi.advanceTimersByTime(999);
    const count = FakeWebSocket.instances.length;
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances.length).toBe(count + 1);
  });

  it("stops reconnecting after a login-failure NOTICE and hands off to the owner", () => {
    const onAuthFailure = vi.fn();
    const { client, ws } = setup({ onAuthFailure });
    ws.open();
    ws.receive(":tmi.twitch.tv NOTICE * :Login authentication failed");

    expect(onAuthFailure).toHaveBeenCalledOnce();
    expect(client.getStatus()).toBe("auth-failed");
    expect(ws.closed).toBe(true);
    vi.advanceTimersByTime(120_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects at once on RECONNECT and ignores the superseded socket", () => {
    const onChat = vi.fn();
    const { ws: old } = connected({ onChat });
    old.receive(":tmi.twitch.tv RECONNECT");

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(old.closed).toBe(true);
    expect(old.onmessage).toBeNull();
    expect(old.onclose).toBeNull();
  });

  it("does not reconnect after an intentional disconnect or dispose", () => {
    const { client, ws } = connected();
    client.dispose();
    expect(client.getStatus()).toBe("closed");
    expect(ws.closed).toBe(true);
    vi.advanceTimersByTime(120_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    client.connect(CREDS);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

describe("TwitchIrcClient liveness watchdog", () => {
  it("pings on each tick and stays up while anything comes back", () => {
    const { ws } = connected();

    vi.advanceTimersByTime(60_000);
    expect(ws.sent.at(-1)).toBe("PING :dirework");
    ws.receive(":tmi.twitch.tv PONG tmi.twitch.tv :dirework");

    vi.advanceTimersByTime(60_000);
    expect(ws.closed).toBe(false);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("treats a silent tick after its PING as a dead socket and reconnects", () => {
    const onError = vi.fn();
    const { client, ws } = connected({ onError });

    vi.advanceTimersByTime(60_000); // PING goes out
    vi.advanceTimersByTime(60_000); // nothing came back

    expect(ws.closed).toBe(true);
    expect(client.getStatus()).toBe("reconnecting");
    expect(onError).toHaveBeenCalledWith("Twitch IRC went silent — reconnecting");
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("stops the watchdog when the socket closes", () => {
    const { ws } = connected();
    ws.drop();
    const sentBefore = ws.sent.length;
    vi.advanceTimersByTime(60_000);
    expect(ws.sent.length).toBe(sentBefore);
  });
});

describe("TwitchIrcClient chat", () => {
  const privmsg = (tags: string, from: string, text: string) =>
    `@${tags} :${from}!${from}@${from}.tmi.twitch.tv PRIVMSG #streamer :${text}`;

  it("relays a PRIVMSG with its tags, unwrapping /me", () => {
    const onChat = vi.fn();
    const { ws } = connected({ onChat });

    ws.receive(
      privmsg(
        "badges=broadcaster/1;color=#00FF00;display-name=Streamer;user-id=42",
        "streamer",
        "\u0001ACTION !task hi\u0001",
      ),
    );

    expect(onChat).toHaveBeenCalledWith({
      username: "streamer",
      displayName: "Streamer",
      twitchId: "42",
      message: "!task hi",
      color: "#00FF00",
      isMod: false,
      isBroadcaster: true,
    });
  });

  it("forwards the IRC message id the server dedupes on", () => {
    const onChat = vi.fn();
    const { ws } = connected({ onChat });

    ws.receive(privmsg("id=b34ccfc7-4977-403a-8a94-33c6bac34fb8;user-id=42", "viewer", "!done"));

    expect(onChat.mock.calls[0]?.[0]).toMatchObject({
      messageId: "b34ccfc7-4977-403a-8a94-33c6bac34fb8",
    });
  });

  it("ignores the bot's own lines and lines without a user-id", () => {
    const onChat = vi.fn();
    const { ws } = connected({ onChat });
    ws.receive(privmsg("user-id=7", "direbot", "!task loop"));
    ws.receive(privmsg("color=", "viewer", "hello"));
    expect(onChat).not.toHaveBeenCalled();
  });

  it("reports per-user CLEARCHAT and ignores a full clear", () => {
    const onClearChat = vi.fn();
    const { ws } = connected({ onClearChat });
    ws.receive(":tmi.twitch.tv CLEARCHAT #streamer :BadViewer");
    ws.receive(":tmi.twitch.tv CLEARCHAT #streamer");
    expect(onClearChat).toHaveBeenCalledExactlyOnceWith("badviewer");
  });

  it("holds replies until joined, then sends them under the rate limiter", () => {
    const { client, ws } = setup();
    client.say("first");
    client.say("second\r\nJOIN #evil");
    ws.open();
    vi.advanceTimersByTime(5000);
    expect(ws.sent.some((l) => l.startsWith("PRIVMSG"))).toBe(false);

    ws.receive(":tmi.twitch.tv 001 direbot :Welcome");
    vi.advanceTimersByTime(0);
    expect(ws.sent.at(-1)).toBe("PRIVMSG #streamer :first");
    vi.advanceTimersByTime(999);
    expect(ws.sent.at(-1)).toBe("PRIVMSG #streamer :first");
    vi.advanceTimersByTime(1);
    expect(ws.sent.at(-1)).toBe("PRIVMSG #streamer :second JOIN #evil");
  });

  it("drops the oldest queued reply when the queue is full", () => {
    const onError = vi.fn();
    const { client } = setup({ onError });
    for (let i = 0; i <= 100; i++) client.say(`reply ${i}`);
    expect(onError).toHaveBeenCalledWith(
      "Chat send queue full — dropped the oldest queued message",
    );
  });

  it("re-sends a reply Twitch rejected as a duplicate, once, made distinct", () => {
    const { client, ws } = connected();
    client.say("Paw-fect! Done!");
    vi.advanceTimersByTime(0);
    expect(ws.sent.at(-1)).toBe("PRIVMSG #streamer :Paw-fect! Done!");

    const duplicate =
      "@msg-id=msg_duplicate :tmi.twitch.tv NOTICE #streamer :Your message was not sent because it is identical to the previous one you sent, less than 30 seconds ago.";
    ws.receive(duplicate);
    vi.advanceTimersByTime(1000);
    expect(ws.sent.at(-1)).toBe("PRIVMSG #streamer :Paw-fect! Done! \u{E0000}");

    const sent = ws.sent.length;
    ws.receive(duplicate);
    vi.advanceTimersByTime(5000);
    expect(ws.sent.length).toBe(sent);
  });

  it("explains a reply Twitch refused because of a chat mode", () => {
    const onError = vi.fn();
    const { ws } = connected({ onError });
    ws.receive(
      "@msg-id=msg_slowmode :tmi.twitch.tv NOTICE #streamer :This room is in slow mode and you are sending messages too quickly.",
    );
    expect(onError).toHaveBeenCalledWith(
      "Twitch didn't post the bot's reply: slow mode is on. Make the bot a mod (/mod direbot) so it can reply",
    );
  });

  it("surfaces any other NOTICE text as an error", () => {
    const onError = vi.fn();
    const { ws } = connected({ onError });
    ws.receive("@msg-id=msg_something :tmi.twitch.tv NOTICE #streamer :Something happened");
    expect(onError).toHaveBeenCalledWith("NOTICE: Something happened");
    ws.receive(":tmi.twitch.tv NOTICE #streamer");
    expect(onError).toHaveBeenLastCalledWith("NOTICE: ");
  });

  it("ignores a duplicate NOTICE when nothing has been sent yet", () => {
    const { ws } = connected();
    ws.receive("@msg-id=msg_duplicate :tmi.twitch.tv NOTICE #streamer :identical");
    vi.advanceTimersByTime(5000);
    expect(ws.sent.some((l) => l.startsWith("PRIVMSG"))).toBe(false);
  });

  it("relays a PRIVMSG with no optional tags using safe defaults", () => {
    const onChat = vi.fn();
    const { ws } = connected({ onChat });
    ws.receive("@user-id=9;mod=1 :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #streamer :!timer");
    expect(onChat).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "viewer",
        displayName: undefined,
        color: undefined,
        isMod: true,
        isBroadcaster: false,
      }),
    );
    ws.receive("@user-id=9 PRIVMSG #streamer :no prefix");
    ws.receive("@user-id=9 :viewer!viewer@viewer PRIVMSG #streamer");
    expect(onChat).toHaveBeenCalledOnce();
  });

  it("ignores empty replies and replies after dispose", () => {
    const { client, ws } = connected();
    client.say("  \r\n ");
    client.dispose();
    client.say("too late");
    vi.advanceTimersByTime(5000);
    expect(ws.sent.some((l) => l.startsWith("PRIVMSG"))).toBe(false);
  });
});

describe("TwitchIrcClient socket edge cases", () => {
  it("reports a socket error and lets onclose own the reconnect", () => {
    const onError = vi.fn();
    const { ws } = connected({ onError });
    ws.onerror?.();
    expect(onError).toHaveBeenCalledWith("WebSocket error");
    ws.drop();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("schedules a reconnect when the WebSocket constructor throws", () => {
    const onError = vi.fn();
    let fail = true;
    vi.stubGlobal(
      "WebSocket",
      class extends FakeWebSocket {
        constructor(url: string) {
          if (fail) throw new Error("blocked");
          super(url);
        }
      },
    );
    const client = new TwitchIrcClient({ onError });
    client.connect(CREDS);
    expect(onError).toHaveBeenCalledWith("Failed to open WebSocket to Twitch IRC");
    expect(client.getStatus()).toBe("reconnecting");
    fail = false;
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("ignores binary frames and answers a bare PING", () => {
    const onChat = vi.fn();
    const { ws } = connected({ onChat });
    ws.onmessage?.({ data: new ArrayBuffer(4) });
    ws.receive("PING");
    expect(ws.sent.at(-1)).toBe("PONG :tmi.twitch.tv");
  });

  it("cancels pending reconnect and send timers on disconnect", () => {
    const { client, ws } = connected();
    client.say("one");
    client.say("two");
    vi.advanceTimersByTime(0);
    client.disconnect();
    vi.advanceTimersByTime(60_000);
    expect(ws.sent.filter((l) => l.startsWith("PRIVMSG"))).toEqual(["PRIVMSG #streamer :one"]);

    const { client: other, ws: dropped } = connected();
    dropped.drop();
    other.disconnect();
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances.at(-1)).toBe(dropped);
  });
});
