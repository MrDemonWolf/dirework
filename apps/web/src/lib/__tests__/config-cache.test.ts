import { readFileSync } from "node:fs";
import path from "node:path";

import { QueryClient, QueryObserver, queryOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PHASE_LABELS,
  DEFAULT_TASK_MESSAGES,
  DEFAULT_TASK_STYLES,
  DEFAULT_TIMER_MESSAGES,
  DEFAULT_TIMER_STYLES,
  TIMER_CONFIG_DEFAULTS,
} from "@dirework/api/config-defaults";

import {
  type ConfigData,
  applyConfigResult,
  botMutedSaved,
  botSettingsSaved,
  stylesSaved,
  timerConfigSaved,
} from "../config-cache";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

const saved: ConfigData = {
  timerConfig: { ...TIMER_CONFIG_DEFAULTS, labels: DEFAULT_PHASE_LABELS },
  timerStyles: DEFAULT_TIMER_STYLES,
  taskStyles: DEFAULT_TASK_STYLES,
  botConfig: {
    taskCommandsEnabled: true,
    timerCommandsEnabled: true,
    commandAliases: {},
    muted: false,
    blockedViewers: ["spammer"],
    taskAccess: "everyone",
    task: DEFAULT_TASK_MESSAGES,
    timer: DEFAULT_TIMER_MESSAGES,
  },
} as ConfigData;

/** The config as the server has it: what a `config.get` read answers. */
let server: ConfigData;
/** Set while a read is on the wire: a read that leaves now waits for it before answering. */
let wire: Promise<void> | null;
let reads: number;

const config = queryOptions({
  queryKey: [["config", "get"], { type: "query" }],
  queryFn: async (): Promise<ConfigData> => {
    reads += 1;
    // The server reads the rows when the request arrives; the answer may arrive much later.
    const answer = server;
    const delivery = wire;
    if (delivery) await delivery;
    return answer;
  },
});

let queryClient: QueryClient;
let unsubscribe: () => void;

beforeEach(async () => {
  server = saved;
  wire = null;
  reads = 0;
  queryClient = new QueryClient();
  // A mounted editor: an active observer, so an invalidation would refetch at once.
  const observer = new QueryObserver(queryClient, {
    ...config,
    staleTime: Number.POSITIVE_INFINITY,
  });
  unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(queryClient.getQueryData(config.queryKey)).toEqual(saved));
  reads = 0;
});

afterEach(() => {
  unsubscribe();
  queryClient.clear();
});

/** Let every fetch the change started settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
}

const cached = () => queryClient.getQueryData(config.queryKey);

describe("applyConfigResult", () => {
  it("merges a save's answer into config.get and never re-reads it", async () => {
    const timerConfig = { ...saved.timerConfig, workDuration: 50 * 60 * 1000 };
    server = { ...saved, timerConfig };
    await applyConfigResult(queryClient, config.queryKey, timerConfigSaved(timerConfig));
    // Already there when the promise settles, so the mutation's pending state covers it.
    expect(cached()).toEqual(server);
    await settle();
    expect(reads).toBe(0);
  });

  it("reads config.get once when nothing is cached to merge into", async () => {
    // The first load failed: the page shows its retry, and a save has nothing to merge into.
    unsubscribe();
    queryClient.clear();
    let failFirst = true;
    const observer = new QueryObserver(queryClient, {
      ...config,
      queryFn: async (ctx) => {
        if (failFirst) {
          failFirst = false;
          throw new Error("first load failed");
        }
        return config.queryFn!(ctx);
      },
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    });
    unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));

    server = { ...saved, botConfig: { ...saved.botConfig, muted: true } };
    await applyConfigResult(queryClient, config.queryKey, botMutedSaved({ muted: true }));
    expect(reads).toBe(1);
    expect(cached()).toEqual(server);
  });

  it("cancels a read still on the wire, so the config it read before the write never lands", async () => {
    let deliver!: () => void;
    wire = new Promise<void>((resolve) => {
      deliver = resolve;
    });
    void queryClient.refetchQueries({ queryKey: config.queryKey });
    await vi.waitFor(() => expect(reads).toBe(1));
    wire = null;

    server = { ...saved, botConfig: { ...saved.botConfig, muted: true } };
    await applyConfigResult(queryClient, config.queryKey, botMutedSaved({ muted: true }));
    // The read's answer (taken while the bot was unmuted) arrives after the write's.
    deliver();
    await settle();
    expect(cached()?.botConfig.muted).toBe(true);
    expect(reads).toBe(1);
  });
});

describe("the merges", () => {
  it("timerConfigSaved replaces the timer config and nothing else", () => {
    const timerConfig = { ...saved.timerConfig, defaultCycles: 6 };
    expect(timerConfigSaved(timerConfig)(saved)).toEqual({ ...saved, timerConfig });
  });

  it("stylesSaved takes both style sets and the timer config (phase labels) it answers with", () => {
    const answer = {
      timerStyles: { ...saved.timerStyles, ring: { ...saved.timerStyles.ring, enabled: false } },
      taskStyles: saved.taskStyles,
      timerConfig: { ...saved.timerConfig, labels: { ...DEFAULT_PHASE_LABELS, work: "Deep" } },
    };
    expect(stylesSaved(answer)(saved)).toEqual({ ...saved, ...answer });
  });

  it("botSettingsSaved takes only the fields the save sent", () => {
    // The answer is the whole bot_config row as of this write. A mute or a block that landed
    // in the cache after this request left (its own answer, or a block's re-read) must not be
    // put back by it.
    const answer = {
      ...saved.botConfig,
      timerCommandsEnabled: false,
      muted: false,
      blockedViewers: [],
    };
    const now = { ...saved, botConfig: { ...saved.botConfig, muted: true } };
    expect(botSettingsSaved(answer, { timerCommandsEnabled: false })(now)).toEqual({
      ...now,
      botConfig: { ...now.botConfig, timerCommandsEnabled: false },
    });
  });

  it("botSettingsSaved takes the server's normalized value, not the one sent", () => {
    const answer = { ...saved.botConfig, commandAliases: { t: "task" } };
    expect(
      botSettingsSaved(answer, { commandAliases: { "!t": "!task" } })(saved).botConfig
        .commandAliases,
    ).toEqual({ t: "task" });
  });

  it("botMutedSaved flips muted and keeps the rest of the bot config", () => {
    expect(botMutedSaved({ muted: true })(saved)).toEqual({
      ...saved,
      botConfig: { ...saved.botConfig, muted: true },
    });
  });
});

describe("the config writes", () => {
  const sites: [string, RegExp][] = [
    ["components/timer-controls.tsx", /timerConfigSaved\(/],
    ["lib/use-draft.ts", /merge\(saved, sent\)/],
    // The instant settings hand their merge to useInstantSetting, which applies it.
    ["lib/use-instant-setting.ts", /merge\(saved, sent\)/],
  ];

  it.each(sites)("%s merges its answer and never re-reads config.get", (file, merge) => {
    const code = read(file);
    expect(code).toMatch(merge);
    expect(code).toContain("applyConfigResult(");
    expect(code).not.toMatch(/invalidateQueries\(\{\s*queryKey: trpc\.config\.get\.queryKey\(\)/);
  });

  it.each([
    ["lib/use-command-group-switch.ts", "merge: botSettingsSaved"],
    ["lib/use-task-access.ts", "merge: botSettingsSaved"],
    ["components/bot-settings/bot-live-controls.tsx", "merge: botMutedSaved"],
  ])("%s saves as an instant setting with its merge", (file, merge) => {
    const code = read(file);
    expect(code).toContain("useInstantSetting(");
    expect(code).toContain(merge);
    expect(code).not.toMatch(/invalidateQueries\(\{\s*queryKey: trpc\.config\.get\.queryKey\(\)/);
  });

  // The draft editors hand their procedure's merge to useSettingsSave (lib/use-draft.ts, above),
  // which applies it.
  const editors: [string, RegExp][] = [
    ["app/(app)/dashboard/styles/styles-page.tsx", /merge: stylesSaved/],
    ["app/(app)/dashboard/bot/(sections)/replies/replies-page.tsx", /merge: botSettingsSaved/],
    ["app/(app)/dashboard/bot/(sections)/commands/commands-page.tsx", /merge: botSettingsSaved/],
  ];

  it.each(editors)("%s saves through useSettingsSave with its merge", (file, merge) => {
    const code = read(file);
    expect(code).toContain("useSettingsSave(");
    expect(code).toMatch(merge);
    expect(code).not.toContain("invalidateQueries");
  });

  it("block and unblock still re-read config.get (the server decides the list)", () => {
    expect(read("components/bot-settings/blocked-viewers-card.tsx")).toMatch(
      /invalidateQueries\(\{\s*queryKey: trpc\.config\.get\.queryKey\(\)/,
    );
  });
});
