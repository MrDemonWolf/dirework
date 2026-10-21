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

describe("dashboard layout", () => {
  it("shows the bot's status exactly once, on the bot strip", () => {
    // The header used to carry a second "Bot ready" / "Bot not connected" chip.
    expect(dashboard).not.toContain("Bot ready");
    expect(dashboard).not.toContain("Bot not connected");
    const botChips = dashboard.match(/<StatusChip[^>]*label="(Ready|Not connected)"/g) ?? [];
    expect(botChips).toHaveLength(2); // one per branch of the strip's ternary
    expect(dashboard.match(/botAccount \? \(/g)).toHaveLength(1);
  });

  it("splits the timer console 3/5 | 2/5 and the board 2/3 | 1/3", () => {
    expect(dashboard).toContain('<div className="grid lg:grid-cols-5">');
    expect(dashboard).toMatch(/lg:col-span-3">\s*<TimerInstrument \/>/);
    expect(dashboard).toMatch(/<TimerTransport \/>\s*<TimerSettings \/>\s*<OverlayMonitor/);
    expect(taskManager).toContain("lg:grid-cols-3");
    expect(taskManager).toContain("lg:col-span-2");
    // The skeleton keeps the same shapes, so the hand-off doesn't jump.
    expect(skeleton).toContain("lg:grid-cols-5");
    expect(skeleton).toContain("lg:grid-cols-3");
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
