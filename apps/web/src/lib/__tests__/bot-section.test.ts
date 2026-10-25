import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { botSectionStatus } from "@/lib/bot-section";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

const loaded = (data: unknown = { ok: true }) => ({ isPending: false, data });
const pending = () => ({ isPending: true, data: undefined });
const failed = () => ({ isPending: false, data: undefined });

describe("botSectionStatus", () => {
  it("is ready once every query the card needs has data", () => {
    expect(botSectionStatus([loaded(), loaded()])).toEqual({ kind: "ready" });
    expect(botSectionStatus([loaded()])).toEqual({ kind: "ready" });
  });

  it("keeps the placeholder while any needed query is still loading", () => {
    expect(botSectionStatus([loaded(), pending()])).toEqual({ kind: "loading" });
    // Loading wins over a failure: the retry waits until the other query has settled.
    expect(botSectionStatus([failed(), pending()])).toEqual({ kind: "loading" });
  });

  it("names the query that settled without data, so its retry refetches that one", () => {
    const user = failed();
    const status = botSectionStatus([loaded(), user]);
    expect(status.kind).toBe("failed");
    expect(status.kind === "failed" && status.query).toBe(user);
  });

  it("only reads the queries it is given: a card never waits on one it does not need", () => {
    // The Commands page needs config only; a slow or failed user.me is not its concern.
    expect(botSectionStatus([loaded()])).toEqual({ kind: "ready" });
    expect(botSectionStatus([])).toEqual({ kind: "ready" });
  });

  it("treats falsy-but-present data as loaded", () => {
    expect(botSectionStatus([loaded(null), loaded(0)])).toEqual({ kind: "ready" });
  });
});

describe("Bot settings wiring", () => {
  const SECTIONS = "app/(app)/dashboard/bot/(sections)";
  const overview = read(`${SECTIONS}/overview-page.tsx`);
  const commands = read(`${SECTIONS}/commands/commands-page.tsx`);
  const replies = read(`${SECTIONS}/replies/replies-page.tsx`);
  const moderation = read(`${SECTIONS}/moderation/moderation-page.tsx`);
  const data = read(`${SECTIONS}/bot-data.tsx`);

  it("streams both queries from the (sections) layout, no whole-page gate", () => {
    const layout = read(`${SECTIONS}/layout.tsx`);
    expect(layout).toContain("streamBot()");
    expect(layout).not.toContain("BotDataGate");
    for (const page of [overview, commands, replies, moderation]) {
      expect(page).not.toContain("useBotData");
    }
  });

  it("gives each card the queries it reads, and a placeholder", () => {
    // Overview: the arrangement and the account/console cards read user.me; the live
    // controls read config.get inside it, so a slow config holds back only that card.
    expect(overview).toMatch(/needs=\{\["user"\]\} fallback=\{<BotOverviewPlaceholder \/>\}/);
    expect(overview).toMatch(/needs=\{\["config"\]\}\s*fallback=\{<LiveControlsPlaceholder/);
    expect(commands).toMatch(/needs=\{\["config"\]\} fallback=\{<CommandsPlaceholder \/>\}/);
    expect(replies).toMatch(/needs=\{\["config", "user"\]\} fallback=\{<RepliesPlaceholder \/>\}/);
    expect(moderation).toMatch(
      /needs=\{\["config"\]\} fallback=\{<BlockedViewersPlaceholder \/>\}/,
    );
    // The static mod-command reference renders outside the card's boundary.
    expect(moderation.indexOf("<CommandReference")).toBeGreaterThan(
      moderation.indexOf("</BotSection>"),
    );
  });

  it("never refetches on mount, so a sub-page switch costs no api request", () => {
    expect(data.match(/queryOptions\(\), refetchOnMount: false \}/g)).toHaveLength(2);
    // A failed load shows a retry, never editors seeded from defaults.
    expect(data).toContain("<QueryError");
  });
});
