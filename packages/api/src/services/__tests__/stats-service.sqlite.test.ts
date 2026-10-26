import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@dirework/db";
import { TIMER_CONFIG_DEFAULTS } from "@dirework/db/defaults";
import { provisionSingletonRows } from "@dirework/db/provision";
import * as schema from "@dirework/db/schema";

import { createSqliteDb } from "../../__tests__/helpers/sqlite-db";
import { STATS_RETENTION_DAYS, addDays } from "../../stats-days";
import {
  getStatsSummary,
  pruneDailyStats,
  recordFocusCredits,
  setStatsTimeZone,
} from "../stats-service";
import { markTaskDone, removeTask, replaceActiveTask, restoreTask } from "../task-service";
import {
  maybeAdvanceOverdueTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  skipTimer,
  startTimer,
} from "../timer-service";

/**
 * Dashboard stats against a real SQLite engine with every migration applied: the upserts,
 * the "count only if the guarded UPDATE won" statement, the chat-share subquery and the
 * primary-key range reads are SQL, so a mock would ignore exactly what matters.
 */

let db: DbClient;
let sqlite: Awaited<ReturnType<typeof createSqliteDb>>["sqlite"];

// 2026-10-26 15:00:00.123 UTC, a Monday — 10:00 in Chicago (CDT, UTC-5).
const T0 = Date.UTC(2026, 9, 26, 15, 0, 0, 123);
const WORK = TIMER_CONFIG_DEFAULTS.workDuration;
const START = TIMER_CONFIG_DEFAULTS.startingDuration;
const OWNER_TWITCH_ID = "1001";

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  ({ db, sqlite } = await createSqliteDb());
  await provisionSingletonRows(db);
});

afterEach(() => {
  vi.useRealTimers();
});

interface RawStat {
  day: string;
  focus_ms: number;
  pomodoros: number;
  tasks_done: number;
  tasks_done_chat: number;
}

function rawStats(): RawStat[] {
  const [result] = sqlite.exec(
    "SELECT day, focus_ms, pomodoros, tasks_done, tasks_done_chat FROM daily_stat ORDER BY day",
  );
  if (!result) return [];
  return result.values.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]])),
  ) as unknown as RawStat[];
}

/** Start a session and skip past "starting", so the timer sits at the top of work phase 1. */
async function startWork() {
  await startTimer(db);
  vi.setSystemTime(Date.now() + START);
  await maybeAdvanceOverdueTimer(db);
  const timer = await db.query.timerState.findFirst();
  expect(timer?.status).toBe("work");
  return timer?.targetEndTime?.getTime() ?? 0;
}

describe("timer phases → daily_stat", () => {
  it("credits a work phase that ran to its end with its full length and a pomodoro", async () => {
    const workEnd = await startWork();
    expect(rawStats()).toEqual([]);

    vi.setSystemTime(workEnd + 1);
    await maybeAdvanceOverdueTimer(db);

    expect(rawStats()).toEqual([
      { day: "2026-10-26", focus_ms: WORK, pomodoros: 1, tasks_done: 0, tasks_done_chat: 0 },
    ]);
  });

  it("a poll that advances nothing writes nothing", async () => {
    await startWork();
    const writes: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      if (!/^select/i.test(query.trim())) writes.push(query);
      return prepare(query, params);
    });

    await maybeAdvanceOverdueTimer(db);
    spy.mockRestore();

    expect(writes).toEqual([]);
    expect(rawStats()).toEqual([]);
  });

  it("two pollers advancing the same phase count it once", async () => {
    const workEnd = await startWork();
    vi.setSystemTime(workEnd + 1);

    const [a, b] = await Promise.all([maybeAdvanceOverdueTimer(db), maybeAdvanceOverdueTimer(db)]);

    expect(a?.status).toBe("break");
    expect(b?.status).toBe("break");
    expect(rawStats()).toMatchObject([{ focus_ms: WORK, pomodoros: 1 }]);
  });

  it("puts each caught-up phase on the local day it ended", async () => {
    await setStatsTimeZone(db, "America/Chicago");
    // 23:20 Chicago on Oct 26: work phase 1 ends before midnight, phase 2 after it.
    vi.setSystemTime(Date.UTC(2026, 9, 27, 4, 20, 0));
    const workEnd = await startWork();
    const breakMs = TIMER_CONFIG_DEFAULTS.breakDuration;

    // Nobody polls until both work phases are over.
    vi.setSystemTime(workEnd + breakMs + WORK + 1);
    await maybeAdvanceOverdueTimer(db);

    expect(rawStats()).toEqual([
      { day: "2026-10-26", focus_ms: WORK, pomodoros: 1, tasks_done: 0, tasks_done_chat: 0 },
      { day: "2026-10-27", focus_ms: WORK, pomodoros: 1, tasks_done: 0, tasks_done_chat: 0 },
    ]);
  });

  it("a skipped work phase counts its worked time, without paused time or a pomodoro", async () => {
    await startWork();
    vi.setSystemTime(Date.now() + 5 * 60_000); // 5 min worked
    await pauseTimer(db);
    vi.setSystemTime(Date.now() + 60 * 60_000); // an hour paused
    await resumeTimer(db);
    vi.setSystemTime(Date.now() + 2 * 60_000); // 2 more minutes

    await skipTimer(db);

    expect(rawStats()).toMatchObject([{ focus_ms: 7 * 60_000, pomodoros: 0 }]);
  });

  it("skipping a break counts nothing", async () => {
    const workEnd = await startWork();
    vi.setSystemTime(workEnd + 1);
    await maybeAdvanceOverdueTimer(db); // into the break: one pomodoro
    vi.setSystemTime(Date.now() + 60_000);

    await skipTimer(db);

    expect(rawStats()).toMatchObject([{ focus_ms: WORK, pomodoros: 1 }]);
  });

  it("a reset counts the worked time once, even when repeated", async () => {
    await startWork();
    vi.setSystemTime(Date.now() + 3 * 60_000);

    await resetTimer(db);
    await resetTimer(db);

    expect(rawStats()).toMatchObject([{ focus_ms: 3 * 60_000, pomodoros: 0 }]);
    expect((await db.query.timerState.findFirst())?.status).toBe("idle");
  });

  it("a reset after the phase already ended counts the whole phase as a pomodoro", async () => {
    const workEnd = await startWork();
    vi.setSystemTime(workEnd + 60_000);

    await resetTimer(db);

    expect(rawStats()).toMatchObject([{ focus_ms: WORK, pomodoros: 1 }]);
  });
});

describe("task done → daily_stat", () => {
  beforeEach(async () => {
    await db.insert(schema.user).values({
      id: "owner",
      name: "streamer",
      email: "owner@example.test",
      twitchId: null,
      isOwner: true,
    });
    // The owner's row has no twitch_id; their Twitch id lives on the account row.
    await db.insert(schema.account).values({
      id: "acct",
      accountId: OWNER_TWITCH_ID,
      providerId: "twitch",
      userId: "owner",
    });
  });

  async function seedTask(id: string, authorTwitchId: string, status = "active") {
    await db.insert(schema.task).values({
      id,
      authorTwitchId,
      authorUsername: `u${authorTwitchId}`,
      authorDisplayName: `U${authorTwitchId}`,
      text: `task ${id}`,
      status: status as "active",
      order: 1,
    });
  }

  it("counts owner and chat tasks, and only chat ones in tasks_done_chat", async () => {
    await seedTask("mine", OWNER_TWITCH_ID);
    await seedTask("viewer", "2002");
    await seedTask("viewer-pending", "2002", "pending");

    await markTaskDone(db, "mine");
    await markTaskDone(db, "viewer");
    await markTaskDone(db, "viewer-pending");

    expect(rawStats()).toMatchObject([{ day: "2026-10-26", tasks_done: 3, tasks_done_chat: 2 }]);
  });

  it("marking an already-done task again counts nothing", async () => {
    await seedTask("t", "2002");
    await markTaskDone(db, "t");
    await markTaskDone(db, "t");
    expect(rawStats()).toMatchObject([{ tasks_done: 1, tasks_done_chat: 1 }]);
  });

  it("restoring a removed done task never counts it again", async () => {
    await seedTask("t", "2002");
    await markTaskDone(db, "t");
    const removed = await removeTask(db, "t");
    if (!removed) throw new Error("not removed");

    await restoreTask(db, { ...removed, status: "done" });

    expect((await db.query.task.findFirst())?.status).toBe("done");
    expect(rawStats()).toMatchObject([{ tasks_done: 1 }]);
  });

  it("!next counts the task it completes, and a stale !next counts nothing", async () => {
    await seedTask("old", "2002");
    const author = { twitchId: "2002", username: "u2002", displayName: "U2002" };

    await replaceActiveTask(db, { id: "old" }, author, "new one");
    await replaceActiveTask(db, { id: "old" }, author, "stale");

    expect(rawStats()).toMatchObject([{ tasks_done: 1, tasks_done_chat: 1 }]);
  });

  it("lands on the owner's local day", async () => {
    await setStatsTimeZone(db, "Asia/Tokyo"); // 00:00 Oct 27 in Tokyo at T0
    await seedTask("t", OWNER_TWITCH_ID);
    await markTaskDone(db, "t");
    expect(rawStats()).toMatchObject([{ day: "2026-10-27", tasks_done: 1, tasks_done_chat: 0 }]);
  });
});

describe("retention, time zone and the summary read", () => {
  it("prunes rows past retention and keeps the rest (and runs on timer start)", async () => {
    const today = "2026-10-26";
    const old = addDays(today, -STATS_RETENTION_DAYS - 1);
    const kept = addDays(today, -STATS_RETENTION_DAYS + 1);
    await db.insert(schema.dailyStat).values([
      { day: old, focusMs: 1 },
      { day: kept, focusMs: 2 },
      { day: today, focusMs: 3 },
    ]);

    await startTimer(db);

    expect(rawStats().map((row) => row.day)).toEqual([kept, today]);
    expect(await pruneDailyStats(db)).toBe(0);
  });

  it("sums repeated credits for the same day with one upsert each", async () => {
    await recordFocusCredits(db, [{ at: T0, focusMs: 1000, pomodoros: 1 }], null);
    await recordFocusCredits(
      db,
      [
        { at: T0, focusMs: 500, pomodoros: 0 },
        { at: T0 + 1, focusMs: 250, pomodoros: 1 },
      ],
      null,
    );
    expect(rawStats()).toMatchObject([{ focus_ms: 1750, pomodoros: 2 }]);
  });

  it("stores the zone only when it changes", async () => {
    expect(await setStatsTimeZone(db, "Europe/Berlin")).toBe(true);
    expect(await setStatsTimeZone(db, "Europe/Berlin")).toBe(false);
    expect(await setStatsTimeZone(db, "UTC")).toBe(true);
  });

  it("summarizes the stored window", async () => {
    await db.insert(schema.dailyStat).values([
      { day: "2026-10-26", focusMs: 50 * 60_000, pomodoros: 2, tasksDone: 4, tasksDoneChat: 3 },
      { day: "2026-10-20", focusMs: 25 * 60_000, pomodoros: 1 },
      { day: "2026-10-14", focusMs: 25 * 60_000, pomodoros: 1 },
    ]);

    const summary = await getStatsSummary(db);

    expect(summary.today).toMatchObject({ tasksDone: 4, tasksDoneChat: 3, pomodoros: 2 });
    expect(summary.week).toMatchObject({ focusDays: 1, pomodoros: 2 });
    expect(summary.streak).toEqual({ weeks: 3, capped: false });
    expect(summary.days).toHaveLength(14);
    expect(summary.days.at(-1)).toEqual({ day: "2026-10-26", focusMs: 50 * 60_000 });
  });

  it("never full-scans daily_stat (summary range read, prune)", async () => {
    const statements: string[] = [];
    const prepare = sqlite.prepare.bind(sqlite);
    const spy = vi.spyOn(sqlite, "prepare").mockImplementation((query, params) => {
      statements.push(query);
      return prepare(query, params);
    });

    await getStatsSummary(db);
    await pruneDailyStats(db);
    spy.mockRestore();

    const statQueries = [...new Set(statements.filter((q) => /"daily_stat"/i.test(q)))];
    expect(statQueries).toHaveLength(2);
    for (const query of statQueries) {
      const params = (query.match(/\?/g) ?? []).map(() => "2026-01-01");
      const [plan] = sqlite.exec(`EXPLAIN QUERY PLAN ${query}`, params);
      const details = (plan?.values ?? []).map((row) => String(row[3]));
      expect(details.join(" | "), query).toMatch(/SEARCH "?daily_stat"? USING .*INDEX/);
      expect(
        details.filter((d) => /^SCAN "?daily_stat"?\b/.test(d)),
        query,
      ).toEqual([]);
    }
  });
});
