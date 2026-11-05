import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { BUILD_ID_HEADER } from "@dirework/api/build-id";

import { createDeployReloader, DEPLOY_CONFIRM_MIN_MS, RELOADED_FOR_KEY } from "../deploy-reload";
import { isTimerCountingDown } from "../overlay-view";

/** An answer from the api worker, carrying its build id the way the middleware sends it. */
const answer = (build?: string) =>
  new Response("{}", { headers: build ? { [BUILD_ID_HEADER]: build } : {} });

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

function setup({
  own = "aaa1111",
  // null: the /version.json check failed.
  live = "bbb2222" as string | null,
  storage = memoryStorage() as ReturnType<typeof memoryStorage> | null,
} = {}) {
  let clock = 1_000_000;
  const reload = vi.fn();
  const fetchDeployedBuild = vi.fn(async () => live ?? undefined);
  const reloader = createDeployReloader({
    ownBuild: own,
    fetchDeployedBuild,
    storage,
    reload,
    now: () => clock,
  });
  return {
    reloader,
    reload,
    fetchDeployedBuild,
    storage,
    advance: (ms: number) => {
      clock += ms;
    },
    setLive: (sha: string | null) => {
      live = sha;
    },
  };
}

describe("reload after a deploy", () => {
  it("does nothing while the api answers with this page's own build (no static check)", async () => {
    const t = setup();
    t.reloader.noteResponse(answer("aaa1111"));
    expect(await t.reloader.check(() => true)).toBe(false);
    t.reloader.noteResponse(answer());
    expect(await t.reloader.check(() => true)).toBe(false);
    expect(t.fetchDeployedBuild).not.toHaveBeenCalled();
    expect(t.reload).not.toHaveBeenCalled();
  });

  it("reloads once the web assets serve the api's new build, and only then", async () => {
    const t = setup({ live: "aaa1111" });
    t.reloader.noteResponse(answer("bbb2222"));
    // The api deployed first; the web worker still serves this page's build: wait.
    expect(await t.reloader.check(() => true)).toBe(false);
    expect(t.fetchDeployedBuild).toHaveBeenCalledTimes(1);
    // At most one /version.json check per DEPLOY_CONFIRM_MIN_MS, however often the page polls.
    t.advance(DEPLOY_CONFIRM_MIN_MS - 1);
    expect(await t.reloader.check(() => true)).toBe(false);
    expect(t.fetchDeployedBuild).toHaveBeenCalledTimes(1);

    t.setLive("bbb2222");
    t.advance(1);
    expect(await t.reloader.check(() => true)).toBe(true);
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(t.storage?.data.get(RELOADED_FOR_KEY)).toBe("bbb2222");
    // Never twice from one page.
    t.advance(DEPLOY_CONFIRM_MIN_MS);
    expect(await t.reloader.check(() => true)).toBe(false);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it("waits for a safe moment, checked again after the static check", async () => {
    const t = setup();
    t.reloader.noteResponse(answer("bbb2222"));
    expect(await t.reloader.check(() => false)).toBe(false);
    expect(t.fetchDeployedBuild).not.toHaveBeenCalled();

    // Safe when asked, busy by the time /version.json answered: no reload this round.
    let safe = true;
    const pending = t.reloader.check(() => {
      const now = safe;
      safe = false;
      return now;
    });
    expect(await pending).toBe(false);
    expect(t.reload).not.toHaveBeenCalled();
  });

  it("never loops: a page already reloaded for that build stays put", async () => {
    const storage = memoryStorage();
    storage.setItem(RELOADED_FOR_KEY, "bbb2222");
    const t = setup({ storage });
    t.reloader.noteResponse(answer("bbb2222"));
    expect(await t.reloader.check(() => true)).toBe(false);
    expect(t.fetchDeployedBuild).not.toHaveBeenCalled();
  });

  it("stays off without session storage, for a dev build, or when the check fails", async () => {
    for (const t of [setup({ storage: null }), setup({ own: "dev" }), setup({ live: null })]) {
      t.reloader.noteResponse(answer("bbb2222"));
      expect(await t.reloader.check(() => true)).toBe(false);
      expect(t.reload).not.toHaveBeenCalled();
    }
  });

  it("checks /version.json only once at a time", async () => {
    const t = setup();
    t.reloader.noteResponse(answer("bbb2222"));
    const [first, second] = await Promise.all([
      t.reloader.check(() => true),
      t.reloader.check(() => true),
    ]);
    expect([first, second]).toEqual([true, false]);
    expect(t.fetchDeployedBuild).toHaveBeenCalledTimes(1);
  });
});

describe("where the token pages reload", () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, "../..", rel), "utf8");

  it("publicTrpc hands every answer to the reloader, adding no request", () => {
    expect(read("utils/public-trpc.ts")).toContain("deployReloader()?.noteResponse(response);");
  });

  it("the timer overlay reloads only off a running countdown; the task overlay any time", () => {
    const timer = read("app/(overlay)/overlay/t/[token]/page.tsx");
    expect(timer).toContain(
      "useReloadAfterDeploy(dataUpdatedAt, !view || !isTimerCountingDown(view.state.status));",
    );
    expect(read("app/(overlay)/overlay/l/[token]/page.tsx")).toContain(
      "useReloadAfterDeploy(dataUpdatedAt, true);",
    );
  });

  it("the bot page checks after getSession and the heartbeat, only when idle", () => {
    const console = read("app/(bot)/bot/[token]/bot-console.tsx");
    expect(console).toContain("publicTrpc.bot.getSession.mutate(input).then(afterCheckIn)");
    expect(console).toContain("publicTrpc.bot.heartbeat.mutate(input).then(afterCheckIn)");
    expect(console).toMatch(
      /deployReloader\(\)\?\.check\(\s*\(\) => sessionRef\.current\?\.idle\(\) === true && !commandBusyRef\.current,?\s*\)/,
    );
  });
});

describe("isTimerCountingDown", () => {
  it("is true while a phase counts down, false idle, paused or finished", () => {
    for (const status of ["starting", "work", "break", "longBreak"]) {
      expect(isTimerCountingDown(status)).toBe(true);
    }
    for (const status of ["idle", "paused", "finished"]) {
      expect(isTimerCountingDown(status)).toBe(false);
    }
  });
});
