import { describe, expect, it } from "vitest";

import {
  BAN_CHECK_SCOPE,
  BOT_SCOPES,
  FOLLOWER_CHECK_SCOPE,
  missingBotScopes,
  readTaskAccess,
  TASK_ACCESS_LEVELS,
  taskAccessVerdict,
  type ChatterStanding,
} from "../bot-permissions";

const nobody: ChatterStanding = {
  isBroadcaster: false,
  isMod: false,
  isVip: false,
  isSubscriber: false,
};

describe("taskAccessVerdict", () => {
  const cases: [string, Partial<ChatterStanding>, Record<string, string>][] = [
    [
      "a plain viewer",
      {},
      { everyone: "allowed", followers: "check-follow", subscribers: "denied", vips: "denied" },
    ],
    [
      "a subscriber",
      { isSubscriber: true },
      { everyone: "allowed", followers: "allowed", subscribers: "allowed", vips: "denied" },
    ],
    [
      "a VIP",
      { isVip: true },
      { everyone: "allowed", followers: "allowed", subscribers: "allowed", vips: "allowed" },
    ],
    [
      "a mod",
      { isMod: true },
      { everyone: "allowed", followers: "allowed", subscribers: "allowed", vips: "allowed" },
    ],
    [
      "the broadcaster",
      { isBroadcaster: true },
      { everyone: "allowed", followers: "allowed", subscribers: "allowed", vips: "allowed" },
    ],
  ];

  it.each(cases)("%s", (_name, standing, expected) => {
    for (const level of TASK_ACCESS_LEVELS) {
      expect(taskAccessVerdict(level, { ...nobody, ...standing }), level).toBe(expected[level]);
    }
  });
});

describe("readTaskAccess", () => {
  it("keeps a known level and reads anything else as everyone", () => {
    expect(readTaskAccess("vips")).toBe("vips");
    expect(readTaskAccess("friends")).toBe("everyone");
    expect(readTaskAccess(null)).toBe("everyone");
  });
});

describe("bot scopes", () => {
  it("requests the follower and ban scopes beside the chat ones, never user:bot", () => {
    expect(BOT_SCOPES).toContain(FOLLOWER_CHECK_SCOPE);
    expect(BOT_SCOPES).toContain(BAN_CHECK_SCOPE);
    expect(BOT_SCOPES).not.toContain("user:bot");
  });

  it("names only the new scopes an older connection lacks", () => {
    expect(missingBotScopes(["chat:read", "chat:edit"])).toEqual([
      FOLLOWER_CHECK_SCOPE,
      BAN_CHECK_SCOPE,
    ]);
    expect(missingBotScopes([...BOT_SCOPES])).toEqual([]);
    expect(missingBotScopes(null)).toEqual([FOLLOWER_CHECK_SCOPE, BAN_CHECK_SCOPE]);
  });
});
