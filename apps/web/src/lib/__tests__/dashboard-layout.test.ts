// Source pins for the dashboard layout (timer console, task board with its monitor):
// accessible names other surfaces and the e2e suite rely on, and the single bot chip.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

const dashboard = read("app/(app)/dashboard/dashboard.tsx");
const taskManager = read("components/task-manager.tsx");
const timerControls = read("components/timer-controls.tsx");
const skeleton = read("components/dashboard-skeleton.tsx");
const obsSources = read("components/obs-sources.tsx");
const stats = read("components/dashboard-stats.tsx");
const refresh = read("lib/stats-refresh.ts");

describe("dashboard layout", () => {
  it("shows the bot's status exactly once, as the header chip that links to Bot settings", () => {
    // The bottom bot strip repeated the header chip; the owner kept the chip.
    expect(dashboard).not.toContain("Bot settings & console");
    // The chip's copy is decided in lib/bot-status.ts (dashboardBotChip), rendered once.
    expect(
      dashboard.match(/<StatusChip tone=\{botChip\.tone\} label=\{botChip\.label\} \/>/g),
    ).toHaveLength(1);
    expect(dashboard.match(/dashboardBotChip\(/g)).toHaveLength(1);
    expect(dashboard).toMatch(/<Link\s+href=\{"\/dashboard\/bot" as const\}[\s\S]*?<StatusChip/);
  });

  it("gives the bot chip link a 44px touch target", () => {
    const link = dashboard.match(/<Link\s+href=\{"\/dashboard\/bot" as const\}[\s\S]*?>/)?.[0];
    expect(link).toContain("pointer-coarse:min-h-11");
  });

  it("keeps the skeleton to the live page's panels (stats strip + two), with no bot strip", () => {
    // An extra skeleton panel would vanish when data lands and jump the layout.
    expect(skeleton.match(/className="panel[ "-]/g)).toHaveLength(3);
    expect(dashboard.match(/<section className="panel/g)).toHaveLength(2);
    expect(stats.match(/<section [^>]*className="panel /g)).toHaveLength(1);
  });

  it("puts the stats strip under the greeting and the focus chart under the timer digits", () => {
    expect(dashboard).toMatch(/<HeaderSection [\s\S]*?<StatTiles \/>[\s\S]*?<TimerConsoleBody \/>/);
    expect(dashboard).toMatch(/<TimerInstrument \/>\s*<ProgressiveSection[\s\S]*?<FocusChart \/>/);
    expect(skeleton).toMatch(/<StatusClusterPlaceholder \/>\s*<\/div>\s*<StatTilesPlaceholder \/>/);
    // The refresh trigger lives in lib/stats-refresh.ts (tested against a real QueryClient):
    // a newer completion (never the purge-prone done count), the timer's phase identity
    // (never the bare status) and local midnight.
    expect(stats).toContain("subscribeStatsRefresh(queryClient, {");
    expect(refresh).toContain("latestDoneAt: tasks ? latestCompletion(tasks) : undefined");
    expect(refresh).not.toContain("counts.done");
    expect(refresh).toContain("timerPhase: timerPhaseKey(queryClient.getQueryData(timerKey))");
    expect(refresh).toContain("scheduleDayRollover(refresh)");
    // Tiles and their placeholder share one cell layout, box for box.
    expect(stats).toContain("className={statCellClass(i)}");
    expect(skeleton).toContain("className={statCellClass(i)}");
  });

  it("splits the timer console 3/5 | 2/5 and gives the task board the full width", () => {
    expect(dashboard).toContain('<div className="grid lg:grid-cols-5">');
    expect(dashboard).toMatch(/lg:col-span-3">\s*<TimerInstrument \/>/);
    // Right column: transport, settings, then both overlay URLs.
    expect(dashboard).toMatch(/<TimerTransport \/>\s*<TimerSettings \/>\s*<ObsSources \/>/);
    expect(taskManager).not.toMatch(/lg:grid-cols-3|lg:col-span-2|monitor/);
    // The skeleton keeps the same shapes, so the hand-off doesn't jump.
    expect(skeleton).toContain("lg:grid-cols-5");
    expect(skeleton).not.toContain("lg:grid-cols-3");
    expect(skeleton).toMatch(/lg:h-15" \/>\s*<ObsSourcesSkeleton \/>/);
  });

  it("merges both overlay URLs into one OBS sources block with Timer / Tasks tabs", () => {
    // One SecretUrlRow, rendered per tab, and no per-panel monitor left behind.
    expect(dashboard).not.toContain("OverlayMonitor");
    expect(dashboard).not.toContain("SecretUrlRow");
    expect(dashboard.match(/<ObsSources \/>/g)).toHaveLength(1);
    expect(obsSources).toContain('label="OBS sources"');
    // Row labels "Timer overlay" / "Tasks overlay" (the e2e suite drives them), sized from the
    // same constants as the Theme Center preview.
    expect(obsSources).toContain('tab: "Timer",');
    expect(obsSources).toContain('tab: "Tasks",');
    expect(obsSources).toContain("const label = `$" + "{tab} overlay`;");
    expect(obsSources).toContain("source: TIMER_SOURCE_FALLBACK");
    expect(obsSources).toContain("source: TASKS_SOURCE");
    expect(obsSources.match(/<SecretUrlRow/g)).toHaveLength(1);
    // The preview iframe only exists while its toggle is on (and its tab is mounted).
    expect(obsSources).toMatch(/\{show && src && \(/);
  });

  it("gives both panels a one-line header: the h2 plus its live state, no eyebrow", () => {
    expect(dashboard).toMatch(
      /<div className=\{PANEL_HEADER_CLASS\}>\s*<h2 className=\{PANEL_TITLE_CLASS\}>Timer<\/h2>\s*<TimerPhaseChip \/>/,
    );
    expect(taskManager).toMatch(
      /<div className=\{PANEL_HEADER_CLASS\}>\s*<h2 className=\{PANEL_TITLE_CLASS\}>Tasks<\/h2>/,
    );
    for (const source of [dashboard, taskManager]) {
      expect(source).not.toMatch(/ConsoleRule label="(Timer Console|Task Board)"/);
    }
    // The placeholders take the same header row.
    expect(skeleton.match(/<PanelHeaderSkeleton>/g)).toHaveLength(2);
    expect(skeleton).toContain("className={PANEL_HEADER_CLASS}");
    // The instrument no longer carries its own chip; the heading does.
    expect(timerControls).toMatch(/export function TimerPhaseChip\(\)[\s\S]*?<StatusChip/);
  });

  it("keeps the bulk clears in the board options menu, behind their confirms", () => {
    expect(taskManager).toContain('aria-label="Task board options"');
    expect(taskManager).toMatch(/<DropdownMenuItem[\s\S]*?>\s*Clear done \(\{doneCount\}\)/);
    expect(taskManager).toMatch(/<DropdownMenuItem[\s\S]*?>\s*Clear all \(\{totalCount\}\)/);
    expect(taskManager).toContain('confirmLabel="Clear done"');
    expect(taskManager).toContain('confirmLabel="Clear all tasks"');
  });

  it("lets author groups fold, in component state only", () => {
    expect(taskManager).toContain("<CollapsibleTrigger");
    expect(taskManager).toContain("collapsedAuthors.has(group.authorKey)");
    expect(taskManager).not.toMatch(/localStorage|sessionStorage/);
  });

  it("gives task rows a 44px minimum and two lines of text", () => {
    expect(taskManager).toContain('"group flex min-h-11 items-center');
    expect(taskManager).toContain("line-clamp-2");
    expect(taskManager).not.toContain("flex-1 truncate text-sm");
  });

  it("keeps the timer names the e2e suite drives", () => {
    expect(timerControls).toContain('aria-label="Stop timer"');
    expect(timerControls).toContain('label: "Start"');
    expect(timerControls).toContain("Timer: {phaseLabel}");
    expect(timerControls).toContain("`Pomodoro $" + "{Math.min(current, total)} of $" + "{total}`");
    expect(timerControls).toContain('title="Edit session settings"');
  });
});
