import { describe, expect, it } from "vitest";

import {
  BRAND,
  DEMO_SESSION,
  SQUIRCLE_RADIUS,
  cssLengthToPx,
  cycleLabel,
  formatClock,
  quoteFontFamily,
  roundedRectPath,
  roundedRectPerimeter,
} from "../index";

describe("SQUIRCLE_RADIUS", () => {
  it("is the canonical 22% squircle fraction", () => {
    expect(SQUIRCLE_RADIUS).toBe(0.22);
  });
});

describe("roundedRectPath", () => {
  it("starts at top-center and closes the path", () => {
    const d = roundedRectPath(0, 0, 100, 100, 10);
    expect(d.startsWith("M 50 0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("clamps the radius to half the smaller side", () => {
    // r=100 on a 100x50 rect clamps to 25 → first line ends at x + w - 25
    const d = roundedRectPath(0, 0, 100, 50, 100);
    expect(d).toContain("L 75 0");
    expect(d).toContain("A 25 25");
  });

  it("draws four arcs of the given radius", () => {
    const d = roundedRectPath(5, 5, 200, 200, 44);
    expect(d.match(/A 44 44/g)).toHaveLength(4);
  });

  it("returns an empty path for zero or negative sizes", () => {
    expect(roundedRectPath(0, 0, 0, 100, 10)).toBe("");
    expect(roundedRectPath(0, 0, 100, -20, 10)).toBe("");
  });
});

describe("roundedRectPerimeter", () => {
  it("matches rectangle perimeter when r = 0", () => {
    expect(roundedRectPerimeter(100, 50, 0)).toBe(300);
  });

  it("matches circle circumference when r = half the side (square)", () => {
    expect(roundedRectPerimeter(100, 100, 50)).toBeCloseTo(2 * Math.PI * 50);
  });

  it("sums straights plus a full circle of the corner radius", () => {
    // 2*(100-20) + 2*(60-20) + 2π*10
    expect(roundedRectPerimeter(100, 60, 10)).toBeCloseTo(240 + 2 * Math.PI * 10);
  });

  it("clamps the radius the same way roundedRectPath does", () => {
    expect(roundedRectPerimeter(100, 50, 100)).toBeCloseTo(roundedRectPerimeter(100, 50, 25));
  });

  it("clamps negative radii to zero", () => {
    expect(roundedRectPerimeter(100, 50, -5)).toBe(300);
  });

  it("is zero (never negative) for zero or negative sizes", () => {
    expect(roundedRectPerimeter(-10, 50, 5)).toBe(0);
    expect(roundedRectPerimeter(50, 0, 5)).toBe(0);
  });
});

describe("formatClock", () => {
  it("formats milliseconds as MM:SS", () => {
    expect(formatClock(25 * 60 * 1000)).toBe("25:00");
    expect(formatClock(61_000)).toBe("01:01");
  });

  it("rounds partial seconds up", () => {
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(59_001)).toBe("01:00");
  });

  it("clamps negative values to 00:00", () => {
    expect(formatClock(-500)).toBe("00:00");
  });

  it("switches to H:MM:SS from 60 minutes up", () => {
    expect(formatClock(59 * 60 * 1000 + 59_000)).toBe("59:59");
    expect(formatClock(59 * 60 * 1000 + 59_001)).toBe("1:00:00");
    expect(formatClock(60 * 60 * 1000)).toBe("1:00:00");
    expect(formatClock(100 * 60 * 1000)).toBe("1:40:00");
    expect(formatClock(24 * 60 * 60 * 1000)).toBe("24:00:00");
  });

  it("pads hours at every length when showHours is on", () => {
    expect(formatClock(0, true)).toBe("00:00:00");
    expect(formatClock(25 * 60 * 1000, true)).toBe("00:25:00");
    expect(formatClock(90 * 60 * 1000 + 1, true)).toBe("01:30:01");
    expect(formatClock(24 * 60 * 60 * 1000, true)).toBe("24:00:00");
  });

  it("treats non-finite input as 00:00", () => {
    expect(formatClock(Number.NaN)).toBe("00:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("00:00");
  });
});

describe("cycleLabel", () => {
  it("prints the counter the way the overlay does", () => {
    expect(cycleLabel(2, 4)).toBe("Cycle 2 / 4");
    expect(cycleLabel(1, 1)).toBe("Cycle 1 / 1");
    expect(cycleLabel(12, 99)).toBe("Cycle 12 / 99");
  });
});

describe("cssLengthToPx", () => {
  it("reads px and unitless values as px", () => {
    expect(cssLengthToPx("250px")).toBe(250);
    expect(cssLengthToPx("120")).toBe(120);
    expect(cssLengthToPx("12.5px")).toBe(12.5);
  });

  it("converts rem/em at the 16px default and pt at 4/3", () => {
    expect(cssLengthToPx("20rem")).toBe(320);
    expect(cssLengthToPx("2em")).toBe(32);
    expect(cssLengthToPx("12pt")).toBe(16);
  });

  it("returns null for layout-relative or invalid lengths", () => {
    expect(cssLengthToPx("50%")).toBeNull();
    expect(cssLengthToPx("30vw")).toBeNull();
    expect(cssLengthToPx("auto")).toBeNull();
  });
});

describe("quoteFontFamily", () => {
  it("quotes a family whose name has a digit-led word", () => {
    expect(quoteFontFamily("Source Sans 3")).toBe('"Source Sans 3"');
  });

  it("re-quotes single-quoted names and keeps generic families bare", () => {
    expect(quoteFontFamily("'Fira Code', monospace")).toBe('"Fira Code", monospace');
    expect(quoteFontFamily("Inter,  Sans-Serif")).toBe('"Inter", Sans-Serif');
  });

  it("drops empty list entries", () => {
    expect(quoteFontFamily("Lato,,")).toBe('"Lato"');
  });
});

describe("BRAND", () => {
  it("builds the document title from the name and the bare tagline", () => {
    expect(BRAND.tagline.endsWith(".")).toBe(false);
    expect(BRAND.title).toBe(`${BRAND.name} - ${BRAND.tagline}`);
    expect(BRAND.description).toContain(BRAND.name);
  });
});

describe("DEMO_SESSION", () => {
  const { tasks, chat, cycle } = DEMO_SESSION;
  const authors = [...new Set(tasks.map((task) => task.author))];

  it("is partway through a focus block, on a cycle that exists", () => {
    expect(DEMO_SESSION.remainingMs).toBeGreaterThan(0);
    expect(DEMO_SESSION.remainingMs).toBeLessThan(DEMO_SESSION.phaseMs);
    expect(formatClock(DEMO_SESSION.remainingMs)).toBe("18:24");
    expect(formatClock(DEMO_SESSION.phaseMs)).toBe("25:00");
    expect(cycle.current).toBeGreaterThanOrEqual(1);
    expect(cycle.current).toBeLessThanOrEqual(cycle.total);
    expect(cycleLabel(cycle.current, cycle.total)).toBe("Cycle 2 / 4");
  });

  it("has three viewers with an active, a started, a pending, one done and one long task", () => {
    expect(authors).toEqual(["ada_codes", "pixel_pat", "night_owl"]);
    const statuses = tasks.map((task) => task.status);
    expect(statuses).toContain("active");
    expect(statuses).toContain("started");
    expect(statuses).toContain("pending");
    expect(statuses.filter((status) => status === "done")).toHaveLength(1);
    expect(tasks.some((task) => task.text.length >= 60)).toBe(true);
  });

  it("gives every viewer with open tasks one active task and at most two started, like the real list", () => {
    for (const author of authors) {
      const open = tasks.filter((task) => task.author === author && task.status !== "done");
      const active = open.filter((task) => task.status === "active");
      const started = open.filter((task) => task.status === "started");
      // Promotion fills the focus first, so open tasks always mean one focus.
      expect(active, author).toHaveLength(open.length === 0 ? 0 : 1);
      expect(started.length, author).toBeLessThanOrEqual(2);
    }
  });

  it("lists each viewer's focus, then started, then the rest, as the server orders them", () => {
    const rank = { active: 0, started: 1, pending: 2, done: 2 } as const;
    for (const author of authors) {
      const ranks = tasks.filter((task) => task.author === author).map((t) => rank[t.status]);
      expect(ranks, author).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it("answers each command with a reply about that viewer and their own task", () => {
    expect(chat[0]?.kind).toBe("command");
    chat.forEach((line, index) => {
      if (line.kind !== "reply") return;
      const previous = chat[index - 1];
      expect(previous?.kind, `line ${index}`).toBe("command");
      if (previous?.kind !== "command") return;
      // A filled-in value missing from the text means the reply was edited by
      // hand instead of being built from the template.
      for (const value of Object.values(line.vars)) expect(line.text).toContain(value);
      if (line.vars.user !== undefined) expect(line.vars.user).toBe(previous.user);
      if (line.vars.task !== undefined) {
        const own = tasks.filter((task) => task.author === previous.user).map((task) => task.text);
        expect(own).toContain(line.vars.task);
      }
    });
  });

  it("adds and finishes the task the list shows as done", () => {
    const added = chat.find((line) => line.kind === "command" && line.text.startsWith("!task "));
    expect(added?.kind).toBe("command");
    if (added?.kind !== "command") return;
    const done = tasks.find((task) => task.status === "done");
    expect(added.text).toBe(`!task ${done?.text}`);
    expect(added.user).toBe(done?.author);
  });
});
