import { describe, expect, it } from "vitest";

import { isDireworkCommandLine } from "@dirework/api/chat-commands";

import {
  DOCK_COMMANDS,
  DOCK_TIMER_COMMANDS,
  dockControls,
  dockResultText,
  type DockCommandId,
} from "../bot-dock-commands";

const ids = Object.keys(DOCK_COMMANDS) as DockCommandId[];
const enabled = (controls: ReturnType<typeof dockControls>) =>
  ids.filter((id) => !controls.disabled[id]);

describe("DOCK_COMMANDS", () => {
  it("each button sends a line the bot page and the server treat as a Dirework command", () => {
    for (const id of ids) {
      expect(isDireworkCommandLine(DOCK_COMMANDS[id].line, new Set())).toBe(true);
    }
  });

  it("sends the chat lines a mod would type", () => {
    expect(DOCK_TIMER_COMMANDS.map((id) => DOCK_COMMANDS[id].line)).toEqual([
      "!timer start",
      "!timer pause",
      "!timer resume",
      "!timer skip",
      "!timer reset",
    ]);
    expect(DOCK_COMMANDS.mute.line).toBe("!mute");
    expect(DOCK_COMMANDS.unmute.line).toBe("!unmute");
    expect(DOCK_COMMANDS["clear-done"].line).toBe("!clear done");
  });

  it("confirms only the destructive ones", () => {
    expect(ids.filter((id) => DOCK_COMMANDS[id].confirm)).toEqual(["timer-reset", "clear-done"]);
  });
});

describe("dockControls", () => {
  it("enables every button on a live, unmuted session, with Mute as the toggle", () => {
    const controls = dockControls({ ready: true, muted: false, busy: false });
    expect(enabled(controls)).toEqual(ids);
    expect(controls.muteToggle).toBe("mute");
    expect(controls.hint).toBeNull();
  });

  it("disables everything before the session is ready", () => {
    const controls = dockControls({ ready: false, muted: false, busy: false });
    expect(enabled(controls)).toEqual([]);
    expect(controls.hint).toMatch(/once the bot is connected/);
  });

  it("disables everything while a click is in flight, so clicks never stack", () => {
    expect(enabled(dockControls({ ready: true, muted: false, busy: true }))).toEqual([]);
    expect(enabled(dockControls({ ready: true, muted: true, busy: true }))).toEqual([]);
  });

  it("while muted only Unmute works: the server ignores every other line", () => {
    const controls = dockControls({ ready: true, muted: true, busy: false });
    expect(enabled(controls)).toEqual(["unmute"]);
    expect(controls.muteToggle).toBe("unmute");
    expect(controls.hint).toBeNull();
  });
});

describe("dockResultText", () => {
  it("shows the bot's replies", () => {
    expect(dockResultText({ ok: true, replies: ["Done."] })).toBe("Done.");
    expect(dockResultText({ ok: true, replies: ["One.", "Two."] })).toBe("One. Two.");
  });

  it("explains an empty reply (a command turned off) and each failure", () => {
    expect(dockResultText({ ok: true, replies: [] })).toMatch(/turned off in Dashboard → Bot/);
    expect(dockResultText({ ok: false, reason: "not-ready" })).toMatch(/isn't connected/);
    // A failed request may still have run (lost response, timeout): never claim nothing changed.
    const failed = dockResultText({ ok: false, reason: "failed" });
    expect(failed).toMatch(/may or may not have run/);
    expect(failed).not.toMatch(/Nothing changed/);
  });
});
