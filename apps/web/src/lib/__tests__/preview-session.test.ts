import { describe, expect, it } from "vitest";

import { DEMO_SESSION } from "@dirework/overlay-kit";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { cn } from "@/lib/utils";
import {
  PREVIEW_BACKDROPS,
  PREVIEW_CYCLE,
  PREVIEW_PHASE_MS,
  PREVIEW_REMAINING_MS,
  PREVIEW_TASKS,
} from "@/lib/preview-session";

describe("Theme Center preview session", () => {
  it("renders the demo session's tasks in order", () => {
    expect(PREVIEW_TASKS.map((t) => [t.authorDisplayName, t.text, t.status])).toEqual(
      DEMO_SESSION.tasks.map((t) => [t.author, t.text, t.status]),
    );
  });

  it("covers an active row and a done row, so both row styles are visible", () => {
    const statuses = PREVIEW_TASKS.map((t) => t.status);
    expect(statuses).toContain("active");
    expect(statuses).toContain("done");
  });

  it("gives every task a unique id and each viewer exactly one color and id", () => {
    expect(new Set(PREVIEW_TASKS.map((t) => t.id)).size).toBe(PREVIEW_TASKS.length);
    const byAuthor = new Map<string, Set<string>>();
    for (const t of PREVIEW_TASKS) {
      const seen = byAuthor.get(t.authorDisplayName) ?? new Set<string>();
      seen.add(`${t.authorTwitchId}|${t.authorColor}`);
      byAuthor.set(t.authorDisplayName, seen);
    }
    for (const seen of byAuthor.values()) expect(seen.size).toBe(1);
  });

  it("leaves one viewer without a chat color, to show the fallback color", () => {
    expect(PREVIEW_TASKS.some((t) => t.authorColor === null)).toBe(true);
    expect(PREVIEW_TASKS.some((t) => t.authorColor !== null)).toBe(true);
  });

  it("opens the timer at the demo session's countdown", () => {
    expect(PREVIEW_PHASE_MS).toBe(DEMO_SESSION.phaseMs);
    expect(PREVIEW_REMAINING_MS).toBe(DEMO_SESSION.remainingMs);
    expect(PREVIEW_CYCLE).toEqual(DEMO_SESSION.cycle);
  });

  it("keeps every backdrop class through cn(), which drops conflicting bg-* classes", () => {
    for (const backdrop of PREVIEW_BACKDROPS) {
      const merged = cn("relative rounded-xl border border-border p-6", backdrop.className);
      for (const cls of backdrop.className.split(" ")) expect(merged.split(" ")).toContain(cls);
    }
  });

  it("defines every backdrop class in index.css", () => {
    const css = readFileSync(fileURLToPath(new URL("../../index.css", import.meta.url)), "utf8");
    const classes = new Set(
      PREVIEW_BACKDROPS.flatMap((b) => [...b.className.split(" "), b.swatch]),
    );
    for (const cls of classes) expect(css).toContain(`.${cls} {`);
  });
});
